create or replace function public.publish_actuals_from_import(p_import_id uuid, p_mapping_version text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org uuid;
  v_batch uuid;
  v_rows integer;
  v_bad integer;
begin
  select organization_id into v_org from public.imports where id = p_import_id for update;
  if v_org is null then raise exception 'Import not found'; end if;
  if not exists (select 1 from public.organization_members m where m.organization_id=v_org and m.user_id=(select auth.uid())) then raise exception 'Not authorized'; end if;
  select count(*) into v_rows from public.import_rows where import_id=p_import_id and validation_status='valid';
  select count(*) into v_bad from public.import_rows where import_id=p_import_id and validation_status in ('pending','warning','error');
  if v_rows=0 or v_bad>0 then raise exception 'Import contains rows that are not valid'; end if;
  if exists (select 1 from public.actuals_publish_batches where import_id=p_import_id and status='published') then
    select id into v_batch from public.actuals_publish_batches where import_id=p_import_id and status='published' order by created_at desc limit 1;
    return v_batch;
  end if;
  if exists (
    select 1 from public.import_rows r
    left join public.account_mappings m on m.organization_id=r.organization_id and m.source_code=(r.payload->>'account_code') and m.status='approved'
    where r.import_id=p_import_id and m.id is null
  ) then raise exception 'Every account must have an approved mapping'; end if;
  insert into public.actuals_publish_batches(organization_id, import_id, mapping_version, status, row_count, published_at)
  values(v_org,p_import_id,p_mapping_version,'published',v_rows,now()) returning id into v_batch;
  update public.imports set status='published', imported_row_count=v_rows, published_at=now() where id=p_import_id;
  return v_batch;
end;
$$;
revoke all on function public.publish_actuals_from_import(uuid,text) from public, anon, authenticated;
