-- Align the permission evaluator with the canonical role + override model.
create or replace function public.has_org_permission(p_organization_id uuid, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path to ''
set row_security to 'off'
as $function$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = (select auth.uid())
      and (select auth.uid()) is not null
      and om.permissions_initialized = true
      and (
        om.role_key = 'company_admin'
        or exists (
          select 1
          from public.organization_member_permission_overrides po
          where po.organization_id = om.organization_id
            and po.user_id = om.user_id
            and po.permission_key = p_permission_key
            and po.granted = true
        )
        or (
          not exists (
            select 1
            from public.organization_member_permission_overrides po
            where po.organization_id = om.organization_id
              and po.user_id = om.user_id
              and po.permission_key = p_permission_key
          )
          and exists (
            select 1
            from public.organization_role_permissions rp
            where rp.organization_id = om.organization_id
              and rp.role_key = om.role_key
              and rp.permission_key = p_permission_key
          )
        )
      )
  );
$function$;

revoke all on function public.has_org_permission(uuid,text) from public,anon;
grant execute on function public.has_org_permission(uuid,text) to authenticated;
