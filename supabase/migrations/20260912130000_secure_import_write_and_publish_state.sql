-- Close the direct import write surface. Imports are created and transitioned only through controlled RPCs.

create or replace function public.ingest_validated_import(
  p_organization_id uuid,
  p_file_name text,
  p_file_hash text,
  p_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := (select auth.uid());
  v_import_id uuid;
  v_existing_id uuid;
  v_row_count integer;
  v_bad_count integer;
  v_unbalanced_count integer;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if p_organization_id is null then
    raise exception 'Organization is required';
  end if;
  if not public.has_org_permission(p_organization_id, 'import') then
    raise exception 'Import permission required for this organization';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows must be a JSON array';
  end if;
  v_row_count := jsonb_array_length(p_rows);
  if v_row_count = 0 then
    raise exception 'Import contains no rows';
  end if;
  if v_row_count > 50000 then
    raise exception 'Import exceeds the 50000 row limit';
  end if;
  if nullif(trim(p_file_name), '') is null then
    raise exception 'File name is required';
  end if;
  if p_file_hash is not null then
    select id into v_existing_id
    from public.imports
    where organization_id = p_organization_id
      and file_hash = p_file_hash
    order by created_at desc
    limit 1;
    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  with parsed as (
    select
      elem,
      ordinality::integer as row_number,
      nullif(trim(elem->>'date'), '') as date_text,
      nullif(trim(elem->>'journal_no'), '') as journal_no,
      nullif(trim(elem->>'account_code'), '') as account_code,
      nullif(trim(elem->>'account_name'), '') as account_name,
      case when coalesce(elem->>'debit', '') ~ '^([0-9]+(\\.[0-9]+)?)$' then (elem->>'debit')::numeric else null end as debit,
      case when coalesce(elem->>'credit', '') ~ '^([0-9]+(\\.[0-9]+)?)$' then (elem->>'credit')::numeric else null end as credit
    from jsonb_array_elements(p_rows) with ordinality
  )
  select count(*) into v_bad_count
  from parsed
  where date_text is null
     or date_text !~ '^\\d{4}-\\d{2}-\\d{2}$'
     or journal_no is null
     or account_code is null
     or account_name is null
     or debit is null
     or credit is null
     or debit < 0
     or credit < 0
     or (debit > 0 and credit > 0)
     or (debit = 0 and credit = 0);
  if v_bad_count > 0 then
    raise exception 'Import contains invalid rows: %', v_bad_count;
  end if;

  with parsed as (
    select elem->>'journal_no' as journal_no,
           (elem->>'debit')::numeric as debit,
           (elem->>'credit')::numeric as credit
    from jsonb_array_elements(p_rows) elem
  ), unbalanced as (
    select journal_no
    from parsed
    group by journal_no
    having abs(sum(debit) - sum(credit)) > 0.005
  )
  select count(*) into v_unbalanced_count from unbalanced;
  if v_unbalanced_count > 0 then
    raise exception 'Import contains % unbalanced journal entries', v_unbalanced_count;
  end if;

  insert into public.imports(
    organization_id, file_name, file_hash, status, row_count,
    imported_row_count, error_count, warning_count, created_by
  )
  values(
    p_organization_id, trim(p_file_name), p_file_hash, 'validated',
    v_row_count, 0, 0, 0, v_user
  )
  returning id into v_import_id;

  insert into public.import_rows(
    import_id, organization_id, row_number, source_key, payload,
    validation_status, validation_message
  )
  select
    v_import_id,
    p_organization_id,
    ordinality::integer,
    coalesce(nullif(elem->>'source_key',''), coalesce(p_file_hash, 'no-hash') || ':' || ordinality::text),
    elem - 'source_key',
    'valid',
    null
  from jsonb_array_elements(p_rows) with ordinality;

  return v_import_id;
end;
$$;

revoke all on table public.imports from anon, authenticated;
grant select on table public.imports to authenticated;
revoke all on function public.ingest_validated_import(uuid, text, text, jsonb) from public, anon;
grant execute on function public.ingest_validated_import(uuid, text, text, jsonb) to authenticated;

alter table public.imports drop constraint if exists imports_status_check;
alter table public.imports add constraint imports_status_check check (status in ('uploaded','validated','published','failed'));

-- Publishing is only valid for an import that completed validation.
-- The publish RPC remains the sole controlled transition to published.

create or replace function public.publish_actuals_from_import(
  p_import_id uuid,
  p_mapping_version text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_status text;
  v_batch uuid;
  v_rows integer;
  v_bad integer;
  r record;
  v_date date;
  v_period uuid;
  v_account uuid;
  v_debit bigint;
  v_credit bigint;
  v_amount bigint;
  v_currency text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  select organization_id, status into v_org, v_status
  from public.imports where id = p_import_id for update;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org, 'import') then raise exception 'Not authorized'; end if;
  if v_status <> 'validated' then raise exception 'Import is not ready for publishing'; end if;

  select count(*) into v_rows from public.import_rows where import_id = p_import_id and validation_status = 'valid';
  select count(*) into v_bad from public.import_rows where import_id = p_import_id and validation_status in ('pending','warning','error');
  if v_rows = 0 or v_bad > 0 then raise exception 'Import contains rows that are not valid'; end if;

  if exists (select 1 from public.actuals_publish_batches where import_id = p_import_id and status = 'published') then
    select id into v_batch from public.actuals_publish_batches where import_id = p_import_id and status = 'published' order by created_at desc limit 1;
    return v_batch;
  end if;

  if exists (
    select 1
    from public.import_rows r
    left join public.account_mappings m
      on m.organization_id = r.organization_id
     and m.source_code = (r.payload->>'account_code')
     and m.status = 'approved'
    where r.import_id = p_import_id and m.id is null
  ) then
    raise exception 'Every account must have an approved mapping';
  end if;

  select o.base_currency into v_currency from public.organizations o where o.id = v_org;
  for r in select * from public.import_rows where import_id = p_import_id and validation_status = 'valid' order by row_number loop
    v_date := (r.payload->>'date')::date;
    select id into v_period from public.financial_periods
    where organization_id = v_org and period_start <= v_date and period_end >= v_date
    order by period_start desc limit 1;
    if v_period is null then
      insert into public.financial_periods(organization_id, period_start, period_end, status)
      values(v_org, date_trunc('month', v_date)::date, (date_trunc('month', v_date) + interval '1 month - 1 day')::date, 'open')
      returning id into v_period;
    end if;

    select target_account_id into v_account from public.account_mappings
    where organization_id = v_org and source_code = (r.payload->>'account_code') and status = 'approved';
    if v_account is null then raise exception 'Every account must have an approved mapping'; end if;

    v_debit := round(coalesce(nullif(r.payload->>'debit','')::numeric,0) * 100)::bigint;
    v_credit := round(coalesce(nullif(r.payload->>'credit','')::numeric,0) * 100)::bigint;
    v_amount := v_debit - v_credit;

    insert into public.financial_facts(
      organization_id, financial_period_id, account_id, currency, amount_minor, fact_type,
      source_import_id, source_row_key, journal_no, description, debit_minor, credit_minor
    ) values(
      v_org, v_period, v_account, v_currency, v_amount, 'actual', p_import_id, r.source_key,
      r.payload->>'journal_no', r.payload->>'description', v_debit, v_credit
    );
  end loop;

  insert into public.actuals_publish_batches(
    organization_id, import_id, mapping_version, status, row_count, published_at
  ) values(v_org, p_import_id, p_mapping_version, 'published', v_rows, now())
  returning id into v_batch;

  update public.imports
  set status = 'published', imported_row_count = v_rows, published_at = now()
  where id = p_import_id;
  return v_batch;
end;
$$;

revoke all on function public.publish_actuals_from_import(uuid, text) from public, anon;
grant execute on function public.publish_actuals_from_import(uuid, text) to authenticated;
