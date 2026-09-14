create or replace function public.get_my_org_access(p_organization_id uuid)
returns table(organization_id uuid, user_id uuid, role_key text, hierarchy_level integer, parent_user_id uuid, permissions_initialized boolean, permission_key text, granted boolean, permission_type text, screen_key text, route_path text, category text, permission_name text)
language sql
security definer
set search_path to ''
as $function$
  select om.organization_id, om.user_id, om.role_key, r.hierarchy_level, om.parent_user_id,
         om.permissions_initialized, p.permission_key,
         case
           when om.role_key = 'company_admin' then true
           else coalesce(po.granted, rp.permission_key is not null, false)
         end as granted,
         p.permission_type, p.screen_key, p.route_path, p.category, p.name
  from public.organization_members om
  join public.organization_roles r
    on r.organization_id = om.organization_id and r.role_key = om.role_key
  cross join public.organization_permissions p
  left join public.organization_role_permissions rp
    on rp.organization_id = om.organization_id
   and rp.role_key = om.role_key
   and rp.permission_key = p.permission_key
  left join public.organization_member_permission_overrides po
    on po.organization_id = om.organization_id
   and po.user_id = om.user_id
   and po.permission_key = p.permission_key
  where om.organization_id = p_organization_id
    and om.user_id = (select auth.uid())
    and (select auth.uid()) is not null
    and om.permissions_initialized = true;
$function$;

create or replace function public.has_org_permission(p_organization_id uuid, p_permission_key text)
returns boolean
language sql
security definer
set search_path to ''
set row_security to 'off'
as $function$
  select exists (
    select 1
    from public.organization_members om
    left join public.organization_member_permission_overrides po
      on po.organization_id = om.organization_id
     and po.user_id = om.user_id
     and po.permission_key = p_permission_key
    left join public.organization_role_permissions rp
      on rp.organization_id = om.organization_id
     and rp.role_key = om.role_key
     and rp.permission_key = p_permission_key
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.permissions_initialized = true
      and (
        om.role_key = 'company_admin'
        or coalesce(po.granted, rp.permission_key is not null, false)
      )
  );
$function$;
