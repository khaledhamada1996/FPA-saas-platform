alter table public.account_mappings add column if not exists mapping_version text;
update public.account_mappings set mapping_version = 'v1' where mapping_version is null or btrim(mapping_version) = '';
alter table public.account_mappings alter column mapping_version set not null;
alter table public.account_mappings drop constraint if exists account_mappings_mapping_version_source_code_key;
alter table public.account_mappings add constraint account_mappings_mapping_version_source_code_key unique (organization_id, mapping_version, source_code);
alter table public.account_mappings add constraint account_mappings_mapping_version_nonblank check (btrim(mapping_version) <> '');

create or replace function public.upsert_account_mapping(p_organization_id uuid,p_mapping_version text,p_source_code text,p_source_name text,p_target_account_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_organization_id is null then raise exception 'Organization is required'; end if;
  if p_mapping_version is null or btrim(p_mapping_version) = '' then raise exception 'Mapping version is required'; end if;
  if p_source_code is null or btrim(p_source_code) = '' then raise exception 'Source code is required'; end if;
  if p_source_name is null or btrim(p_source_name) = '' then raise exception 'Source name is required'; end if;
  if p_target_account_id is null then raise exception 'Target account is required'; end if;
  if not public.has_org_permission(p_organization_id, 'import') then raise exception 'Import permission required'; end if;
  if not exists (select 1 from public.accounts a where a.id=p_target_account_id and a.organization_id=p_organization_id) then raise exception 'Target account does not belong to this organization'; end if;
  select id into v_id from public.account_mappings where organization_id=p_organization_id and mapping_version=btrim(p_mapping_version) and source_code=btrim(p_source_code) for update;
  if v_id is null then
    insert into public.account_mappings(organization_id,mapping_version,source_code,source_name,target_account_id,status,created_by) values(p_organization_id,btrim(p_mapping_version),btrim(p_source_code),btrim(p_source_name),p_target_account_id,'draft',v_user) returning id into v_id;
  else
    if exists (select 1 from public.account_mappings where id=v_id and status='approved') then raise exception 'Approved mapping is immutable; create a new mapping version'; end if;
    update public.account_mappings set source_name=btrim(p_source_name),target_account_id=p_target_account_id,status='draft',rejected_by=null,rejected_at=null,approved_by=null,approved_at=null,updated_at=now() where id=v_id;
  end if;
  return v_id;
end; $$;

create or replace function public.review_account_mapping(p_mapping_id uuid,p_action text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_mapping public.account_mappings%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_action not in ('approve','reject') then raise exception 'Invalid mapping review action'; end if;
  select * into v_mapping from public.account_mappings where id=p_mapping_id for update;
  if not found then raise exception 'Mapping not found'; end if;
  if not public.has_org_permission(v_mapping.organization_id,case when p_action='approve' then 'approve' else 'reject' end) then raise exception 'Required permission is missing'; end if;
  if v_mapping.status not in ('draft','rejected') then raise exception 'Only draft or rejected mappings can be reviewed'; end if;
  if p_action='approve' and v_mapping.created_by=v_user then raise exception 'Mapping creator cannot approve the same mapping'; end if;
  if p_action='approve' then
    update public.account_mappings set status='approved',approved_by=v_user,approved_at=now(),rejected_by=null,rejected_at=null,updated_at=now() where id=p_mapping_id;
  else
    update public.account_mappings set status='rejected',rejected_by=v_user,rejected_at=now(),approved_by=null,approved_at=null,updated_at=now() where id=p_mapping_id;
  end if;
  return p_mapping_id;
end; $$;

revoke all on function public.upsert_account_mapping(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.upsert_account_mapping(uuid,text,text,text,uuid) to authenticated;
revoke all on function public.review_account_mapping(uuid,text) from public,anon;
grant execute on function public.review_account_mapping(uuid,text) to authenticated;
