-- Access model: company creator is fully privileged; subsequent members receive no effective permissions until explicitly granted.

create or replace function public.get_my_org_access(p_organization_id uuid)
returns table(organization_id uuid,user_id uuid,role_key text,hierarchy_level integer,parent_user_id uuid,permissions_initialized boolean,permission_key text,granted boolean,permission_type text,screen_key text,route_path text,category text,permission_name text)
language sql security definer set search_path='' set row_security=off stable
as $$
  select om.organization_id,om.user_id,om.role_key,r.hierarchy_level,om.parent_user_id,om.permissions_initialized,p.permission_key,
    case when om.role_key='company_admin' then true else coalesce(po.granted,false) end,
    p.permission_type,p.screen_key,p.route_path,p.category,p.name
  from public.organization_members om
  join public.organization_roles r on r.organization_id=om.organization_id and r.role_key=om.role_key
  cross join public.organization_permissions p
  left join public.organization_member_permission_overrides po on po.organization_id=om.organization_id and po.user_id=om.user_id and po.permission_key=p.permission_key
  where om.organization_id=p_organization_id and om.user_id=(select auth.uid()) and (select auth.uid()) is not null;
$$;
revoke all on function public.get_my_org_access(uuid) from public;
grant execute on function public.get_my_org_access(uuid) to authenticated;

create or replace function public.has_org_permission(p_organization_id uuid,p_permission_key text)
returns boolean language sql security definer set search_path='' set row_security=off stable
as $$
  select exists(select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=(select auth.uid()) and (select auth.uid()) is not null and om.role_key='company_admin')
  or exists(select 1 from public.organization_members om join public.organization_member_permission_overrides po on po.organization_id=om.organization_id and po.user_id=om.user_id and po.permission_key=p_permission_key where om.organization_id=p_organization_id and om.user_id=(select auth.uid()) and (select auth.uid()) is not null and po.granted=true);
$$;
revoke all on function public.has_org_permission(uuid,text) from public;
grant execute on function public.has_org_permission(uuid,text) to authenticated;

create or replace function public.set_team_member_permission_override(p_organization_id uuid,p_user_id uuid,p_permission_key text,p_granted boolean)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null or not public.has_org_permission(p_organization_id,'manage_users') then raise exception 'User management permission required'; end if;
  if not public.can_manage_member(p_organization_id,p_user_id) then raise exception 'MEMBER_OUTSIDE_YOUR_HIERARCHY'; end if;
  if not exists(select 1 from public.organization_permissions where permission_key=p_permission_key) then raise exception 'Permission not found'; end if;
  if p_granted and not public.has_org_permission(p_organization_id,p_permission_key) then raise exception 'PERMISSION_EXCEEDS_YOUR_ACCESS'; end if;
  insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted) values(p_organization_id,p_user_id,p_permission_key,p_granted)
  on conflict(organization_id,user_id,permission_key) do update set granted=excluded.granted,created_at=now();
  update public.organization_members set permissions_initialized=true where organization_id=p_organization_id and user_id=p_user_id;
  perform public.write_audit_event(p_organization_id,'team_member_permission_changed','organization_member',p_user_id::text,null,jsonb_build_object('permission_key',p_permission_key,'granted',p_granted,'changed_by',v_user));
  return true;
end;
$$;
revoke all on function public.set_team_member_permission_override(uuid,uuid,text,boolean) from public;
grant execute on function public.set_team_member_permission_override(uuid,uuid,text,boolean) to authenticated;

-- Existing non-admin members are migrated to the explicit-grant model.
delete from public.organization_member_permission_overrides po where exists(select 1 from public.organization_members om where om.organization_id=po.organization_id and om.user_id=po.user_id and om.role_key<>'company_admin') and po.granted=true;
update public.organization_members set permissions_initialized=false where role_key<>'company_admin';
update public.organization_members om set permissions_initialized=true where om.role_key='company_admin' and om.user_id=(select om2.user_id from public.organization_members om2 where om2.organization_id=om.organization_id and om2.role_key='company_admin' order by om2.created_at asc limit 1);
