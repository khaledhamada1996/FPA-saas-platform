alter table public.organizations add column if not exists owner_user_id uuid references auth.users(id);

update public.organizations o
set owner_user_id = x.user_id
from (
  select distinct on (organization_id) organization_id, user_id
  from public.organization_members
  where role_key = 'company_admin'
  order by organization_id, created_at asc, user_id asc
) x
where o.id = x.organization_id
  and o.owner_user_id is null;

create unique index if not exists organizations_owner_user_unique on public.organizations(id, owner_user_id);
create unique index if not exists organization_one_company_admin_idx on public.organization_members(organization_id) where role_key = 'company_admin';

create or replace function public.transfer_system_admin_ownership(p_organization_id uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path to ''
set row_security = off
as $$
declare
  v_actor uuid := (select auth.uid());
  v_target uuid;
  v_email text := lower(trim(p_email));
  v_current_owner uuid;
  v_target_member boolean;
  v_before jsonb;
begin
  if v_actor is null then raise exception 'UNAUTHENTICATED'; end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'INVALID_EMAIL'; end if;

  select owner_user_id into v_current_owner
  from public.organizations
  where id = p_organization_id
  for update;

  if v_current_owner is null then raise exception 'OWNER_NOT_INITIALIZED'; end if;
  if v_current_owner <> v_actor then raise exception 'ONLY_CURRENT_SYSTEM_ADMIN_CAN_TRANSFER_OWNERSHIP'; end if;

  select u.id into v_target
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_target is null then raise exception 'TARGET_USER_NOT_FOUND'; end if;
  if v_target = v_actor then raise exception 'TARGET_ALREADY_SYSTEM_ADMIN'; end if;

  select exists(
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id and om.user_id = v_target
  ) into v_target_member;

  if not v_target_member then raise exception 'TARGET_USER_MUST_BE_COMPANY_MEMBER'; end if;

  select jsonb_build_object('owner_user_id',v_current_owner,'target_user_id',v_target) into v_before;

  update public.organization_members
  set role = 'viewer', role_key = 'viewer', permissions_initialized = false, parent_user_id = null
  where organization_id = p_organization_id and user_id = v_current_owner;

  delete from public.organization_member_permission_overrides
  where organization_id = p_organization_id and user_id = v_current_owner;

  update public.organization_members
  set role = 'admin', role_key = 'company_admin', permissions_initialized = true, parent_user_id = null
  where organization_id = p_organization_id and user_id = v_target;

  delete from public.organization_member_permission_overrides
  where organization_id = p_organization_id and user_id = v_target;

  update public.organizations
  set owner_user_id = v_target, updated_at = now()
  where id = p_organization_id;

  perform public.write_audit_event(
    p_organization_id,
    'system_admin_ownership_transferred',
    'organization',
    p_organization_id::text,
    v_before,
    jsonb_build_object('owner_user_id',v_target,'owner_email',v_email)
  );

  return jsonb_build_object('ok',true,'owner_user_id',v_target,'owner_email',v_email);
end;
$$;

revoke all on function public.transfer_system_admin_ownership(uuid,text) from public;
grant execute on function public.transfer_system_admin_ownership(uuid,text) to authenticated;
