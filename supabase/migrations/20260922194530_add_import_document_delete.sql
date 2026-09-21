-- Allow an uploader (or organization admin) to permanently remove an un-published import document.
-- Published/lifecycle-locked imports remain protected and must use the controlled rollback workflow.

create or replace function public.delete_import_document(p_import_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_status text;
  v_created_by uuid;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select organization_id, status, created_by
    into v_org, v_status, v_created_by
  from public.imports
  where id = p_import_id
  for update;

  if v_org is null then
    raise exception 'Import not found';
  end if;

  if not public.has_org_permission(v_org, 'import') then
    raise exception 'Import permission required';
  end if;

  if v_created_by is distinct from v_user
     and not public.has_org_permission(v_org, 'admin') then
    raise exception 'Only the uploader or an organization admin can delete this document';
  end if;

  if v_status in ('published','importing','imported','rolled_back') then
    raise exception 'Published or lifecycle-locked imports cannot be deleted; use the controlled rollback workflow';
  end if;

  delete from public.imports
  where id = p_import_id
    and organization_id = v_org;

  if not found then
    raise exception 'Import could not be deleted';
  end if;

  return true;
end;
$$;

revoke all on function public.delete_import_document(uuid) from public, anon;
grant execute on function public.delete_import_document(uuid) to authenticated;
