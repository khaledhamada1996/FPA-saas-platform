create or replace function public.publish_actuals_from_import(p_import_id uuid, p_mapping_version text)
returns uuid
language plpgsql
security definer
set search_path = ''
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

  if p_mapping_version is null or btrim(p_mapping_version) = '' then
    raise exception 'Mapping version is required';
  end if;

  select organization_id, status
    into v_org, v_status
  from public.imports
  where id = p_import_id
  for update;

  if v_org is null then
    raise exception 'Import not found';
  end if;

  if not public.has_org_permission(v_org, 'import') then
    raise exception 'Not authorized';
  end if;

  if v_status <> 'validated' then
    raise exception 'Import is not ready for publishing';
  end if;

  select count(*) into v_rows
  from public.import_rows
  where import_id = p_import_id and validation_status = 'valid';

  select count(*) into v_bad
  from public.import_rows
  where import_id = p_import_id
    and validation_status in ('pending','warning','error');

  if v_rows = 0 or v_bad > 0 then
    raise exception 'Import contains rows that are not valid';
  end if;

  if exists (
    select 1 from public.actuals_publish_batches
    where import_id = p_import_id and status = 'published'
  ) then
    select id into v_batch
    from public.actuals_publish_batches
    where import_id = p_import_id and status = 'published'
    order by created_at desc limit 1;
    return v_batch;
  end if;

  if exists (
    select 1
    from public.import_rows r
    left join public.account_mappings m
      on m.organization_id = v_org
     and m.source_code = (r.payload->>'account_code')
     and m.status = 'approved'
    where r.import_id = p_import_id and m.id is null
  ) then
    raise exception 'Every account must have an approved mapping';
  end if;

  select o.base_currency into v_currency
  from public.organizations o where o.id = v_org;

  for r in
    select * from public.import_rows
    where import_id = p_import_id and validation_status = 'valid'
    order by row_number
  loop
    v_date := (r.payload->>'date')::date;

    select id into v_period
    from public.financial_periods
    where organization_id = v_org
      and period_start <= v_date and period_end >= v_date
    order by period_start desc limit 1;

    if v_period is null then
      insert into public.financial_periods(
        organization_id, period_start, period_end, status
      )
      values(
        v_org, date_trunc('month', v_date)::date,
        (date_trunc('month', v_date) + interval '1 month - 1 day')::date,
        'open'
      ) returning id into v_period;
    end if;

    select target_account_id into v_account
    from public.account_mappings
    where organization_id = v_org
      and source_code = (r.payload->>'account_code')
      and status = 'approved';

    if v_account is null then
      raise exception 'Every account must have an approved mapping';
    end if;

    v_debit := round(coalesce(nullif(r.payload->>'debit','')::numeric,0) * 100)::bigint;
    v_credit := round(coalesce(nullif(r.payload->>'credit','')::numeric,0) * 100)::bigint;
    v_amount := v_debit - v_credit;

    insert into public.financial_facts(
      organization_id, financial_period_id, account_id, currency,
      amount_minor, fact_type, source_import_id, source_row_key,
      journal_no, description, debit_minor, credit_minor
    )
    values(
      v_org, v_period, v_account, v_currency, v_amount, 'actual',
      p_import_id, r.source_key, r.payload->>'journal_no',
      r.payload->>'description', v_debit, v_credit
    );
  end loop;

  insert into public.actuals_publish_batches(
    organization_id, import_id, mapping_version, status, row_count, published_at
  )
  values(v_org, p_import_id, p_mapping_version, 'published', v_rows, now())
  returning id into v_batch;

  update public.imports
  set status = 'published', imported_row_count = v_rows, published_at = now()
  where id = p_import_id;

  return v_batch;
end;
$$;

revoke execute on function public.publish_actuals_from_import(uuid, text) from public, anon;
grant execute on function public.publish_actuals_from_import(uuid, text) to authenticated;
