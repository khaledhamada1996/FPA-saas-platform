-- Import & Mapping security hardening.
-- Reads require view permission; ingestion requires import permission.

drop policy if exists "imports_member_select" on public.imports;
create policy "imports_member_select" on public.imports
for select to authenticated
using (public.has_org_permission(imports.organization_id, 'view'));

drop policy if exists "members can read import rows" on public.import_rows;
create policy "members can read import rows" on public.import_rows
for select to authenticated
using (public.has_org_permission(import_rows.organization_id, 'view'));

drop policy if exists "members can read account mappings" on public.account_mappings;
create policy "members can read account mappings" on public.account_mappings
for select to authenticated
using (public.has_org_permission(account_mappings.organization_id, 'view'));

drop policy if exists "members can read actuals publish batches" on public.actuals_publish_batches;
create policy "members can read actuals publish batches" on public.actuals_publish_batches
for select to authenticated
using (public.has_org_permission(actuals_publish_batches.organization_id, 'view'));

drop policy if exists "actual_import_batches_member_select" on public.actual_import_batches;
drop policy if exists "tenant members can read import batches" on public.actual_import_batches;
create policy "tenant members can read import batches" on public.actual_import_batches
for select to authenticated
using (public.has_org_permission(actual_import_batches.organization_id, 'view'));

create or replace function public.ingest_validated_import(
  p_organization_id uuid,
  p_file_name text,
  p_file_hash text,
  p_rows jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
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
  if not public.has_org_permission(p_organization_id, 'import') then
    raise exception 'Not authorized for import in this organization';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Rows must be a JSON array'; end if;
  v_row_count := jsonb_array_length(p_rows);
  if v_row_count = 0 then raise exception 'Import contains no rows'; end if;
  if v_row_count > 50000 then raise exception 'Import exceeds the 50000 row limit'; end if;
  if nullif(trim(p_file_name), '') is null then raise exception 'File name is required'; end if;
  if p_file_hash is not null then
    select id into v_existing_id from public.imports
    where organization_id = p_organization_id and file_hash = p_file_hash
    order by created_at desc limit 1;
    if v_existing_id is not null then return v_existing_id; end if;
  end if;
  with parsed as (
    select elem,
      nullif(trim(elem->>'date'), '') as date_text,
      nullif(trim(elem->>'journal_no'), '') as journal_no,
      nullif(trim(elem->>'account_code'), '') as account_code,
      nullif(trim(elem->>'account_name'), '') as account_name,
      case when coalesce(elem->>'debit', '') ~ '^([0-9]+([.][0-9]+)?)$' then (elem->>'debit')::numeric else null end as debit,
      case when coalesce(elem->>'credit', '') ~ '^([0-9]+([.][0-9]+)?)$' then (elem->>'credit')::numeric else null end as credit
    from jsonb_array_elements(p_rows) elem
  )
  select count(*) into v_bad_count from parsed
  where date_text is null or date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or journal_no is null or account_code is null or account_name is null
    or debit is null or credit is null or debit < 0 or credit < 0
    or (debit > 0 and credit > 0) or (debit = 0 and credit = 0);
  if v_bad_count > 0 then raise exception 'Import contains invalid rows: %', v_bad_count; end if;
  with parsed as (
    select elem->>'journal_no' as journal_no,
      (elem->>'debit')::numeric as debit,
      (elem->>'credit')::numeric as credit
    from jsonb_array_elements(p_rows) elem
  ), unbalanced as (
    select journal_no from parsed group by journal_no
    having abs(sum(debit) - sum(credit)) > 0.005
  )
  select count(*) into v_unbalanced_count from unbalanced;
  if v_unbalanced_count > 0 then raise exception 'Import contains % unbalanced journal entries', v_unbalanced_count; end if;
  insert into public.imports(organization_id,file_name,file_hash,status,row_count,imported_row_count,error_count,warning_count,created_by)
  values(p_organization_id,trim(p_file_name),p_file_hash,'validated',v_row_count,0,0,0,v_user)
  returning id into v_import_id;
  insert into public.import_rows(import_id,organization_id,row_number,source_key,payload,validation_status,validation_message)
  select v_import_id,p_organization_id,ordinality::integer,
    coalesce(nullif(elem->>'source_key',''),coalesce(p_file_hash,'no-hash') || ':' || ordinality::text),
    elem - 'source_key','valid',null
  from jsonb_array_elements(p_rows) with ordinality;
  return v_import_id;
end;
$$;

revoke all on function public.ingest_validated_import(uuid,text,text,jsonb) from public, anon;
grant execute on function public.ingest_validated_import(uuid,text,text,jsonb) to authenticated;
