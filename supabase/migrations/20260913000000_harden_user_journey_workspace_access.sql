create or replace function public.get_my_org_access(p_organization_id uuid)
returns table(organization_id uuid,user_id uuid,role_key text,hierarchy_level integer,parent_user_id uuid,permissions_initialized boolean,permission_key text,granted boolean,permission_type text,screen_key text,route_path text,category text,permission_name text)
language sql
security definer
set search_path = ''
as $$
  select om.organization_id, om.user_id, om.role_key, r.hierarchy_level, om.parent_user_id,
         om.permissions_initialized, p.permission_key, coalesce(po.granted,false),
         p.permission_type, p.screen_key, p.route_path, p.category, p.name
  from public.organization_members om
  join public.organization_roles r on r.organization_id=om.organization_id and r.role_key=om.role_key
  join public.organization_permissions p on true
  left join public.organization_member_permission_overrides po
    on po.organization_id=om.organization_id and po.user_id=om.user_id and po.permission_key=p.permission_key
  where om.organization_id=p_organization_id
    and om.user_id=(select auth.uid())
    and (select auth.uid()) is not null
    and om.permissions_initialized=true;
$$;

revoke execute on function public.get_my_org_access(uuid) from anon;
grant execute on function public.get_my_org_access(uuid) to authenticated;

create or replace function public.has_org_permission(p_organization_id uuid,p_permission_key text)
returns boolean language sql security definer set search_path = '' as $$
  select exists(
    select 1 from public.organization_members om
    join public.organization_member_permission_overrides po
      on po.organization_id=om.organization_id and po.user_id=om.user_id
    where om.organization_id=p_organization_id
      and om.user_id=(select auth.uid())
      and (select auth.uid()) is not null
      and om.permissions_initialized=true
      and po.permission_key=p_permission_key
      and po.granted=true
  );
$$;
revoke execute on function public.has_org_permission(uuid,text) from anon;
grant execute on function public.has_org_permission(uuid,text) to authenticated;

create or replace function public.can_access_workspace(p_organization_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select public.has_org_permission(p_organization_id,'workspace.access');
$$;
revoke execute on function public.can_access_workspace(uuid) from anon;
grant execute on function public.can_access_workspace(uuid) to authenticated;
