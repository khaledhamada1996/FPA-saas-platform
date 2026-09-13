-- Keep the production journal import contract in Git with the deployed fix.
-- Fix numeric/date regex escaping and enforce the required journal description.

create or replace function public.ingest_validated_import(
  p_organization_id uuid,
  p_file_name text,
  p_file_hash text,
  p_rows jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_import_id uuid;
  v_existing_id uuid;
  v_row_count integer;
  v_bad_count integer;
  v_unbalanced_count integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_organization_id is null then raise exception 'Organization is required'; end if;
  if not public.has_org_permission(p_organization_id, 'import.create') then
    raise exception 'Import create permission required';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Rows must be a JSON array'; end if;
  v_row_count := jsonb_array_length(p_rows);
  if v_row_count = 0 then raise exception 'Import contains no rows'; end if;
  if v_row_count > 50000 then raise exception 'Import exceeds the 50000 row limit'; end if;
  if nullif(trim(p_file_name), '') is null then raise exception 'File name is required'; end if;

  if p_file_hash is not null then
    select id into v_existing_id
    from public.imports
    where organization_id = p_organization_id and file_hash = p_file_hash
    order by created_at desc limit 1;
    if v_existing_id is not null then return v_existing_id; end if;
  end if;

  with parsed as (
    select
      elem,
      nullif(trim(elem->>'date'), '') date_text,
      nullif(trim(elem->>'journal_no'), '') journal_no,
      nullif(trim(elem->>'description'), '') description,
      nullif(trim(elem->>'account_code'), '') account_code,
      nullif(trim(elem->>'account_name'), '') account_name,
      case when coalesce(elem->>'debit', '') ~ '^([0-9]+(\.[0-9]+)?)$'
        then (elem->>'debit')::numeric else null end debit,
      case when coalesce(elem->>'credit', '') ~ '^([0-9]+(\.[0-9]+)?)$'
        then (elem->>'credit')::numeric else null end credit
    from jsonb_array_elements(p_rows) elem
  )
  select count(*) into v_bad_count
  from parsed
  where date_text is null
     or date_text !~ '^\d{4}-\d{2}-\d{2}( [0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?)?$'
     or journal_no is null
     or description is null
     or account_code is null
     or account_name is null
     or debit is null
     or credit is null
     or debit < 0
     or credit < 0
     or (debit > 0 and credit > 0)
     or (debit = 0 and credit = 0);

  if v_bad_count > 0 then raise exception 'Import contains invalid rows: %', v_bad_count; end if;

  with parsed as (
    select elem->>'journal_no' journal_no,
           (elem->>'debit')::numeric debit,
           (elem->>'credit')::numeric credit
    from jsonb_array_elements(p_rows) elem
  ), unbalanced as (
    select journal_no from parsed group by journal_no
    having abs(sum(debit) - sum(credit)) > 0.005
  )
  select count(*) into v_unbalanced_count from unbalanced;

  if v_unbalanced_count > 0 then
    raise exception 'Import contains % unbalanced journal entries', v_unbalanced_count;
  end if;

  insert into public.imports(
    organization_id, file_name, file_hash, input_type, status,
    row_count, imported_row_count, error_count, warning_count, created_by
  ) values (
    p_organization_id, trim(p_file_name), p_file_hash,
    'actual_journal_transactions', 'mapping_required',
    v_row_count, 0, 0, 0, v_user
  ) returning id into v_import_id;

  insert into public.import_rows(
    import_id, organization_id, row_number, source_key,
    payload, validation_status, validation_message
  )
  select
    v_import_id,
    p_organization_id,
    ordinality::integer,
    coalesce(nullif(elem->>'source_key', ''), coalesce(p_file_hash, 'no-hash') || ':' || ordinality::text),
    elem - 'source_key',
    'valid',
    null
  from jsonb_array_elements(p_rows) with ordinality;

  insert into public.import_audit_events(
    organization_id, import_id, actor_id, action, from_status, to_status, metadata
  ) values (
    p_organization_id, v_import_id, v_user, 'ingest', null, 'mapping_required',
    jsonb_build_object(
      'row_count', v_row_count,
      'file_name', trim(p_file_name),
      'input_type', 'actual_journal_transactions'
    )
  );

  return v_import_id;
end;
$$;

revoke all on function public.ingest_validated_import(uuid, text, text, jsonb) from anon, public;
grant execute on function public.ingest_validated_import(uuid, text, text, jsonb) to authenticated;
