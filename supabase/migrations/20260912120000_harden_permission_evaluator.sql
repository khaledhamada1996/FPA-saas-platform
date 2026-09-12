-- Security hardening: permission overrides must be authoritative and membership is mandatory.
-- A deny override must be able to remove a role-derived permission, and an override
-- must never grant access to a user who is not an organization member.

create or replace function public.has_org_permission(
  p_organization_id uuid,
  p_permission_key text
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and (
        exists (
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
              and rp.role_key = coalesce(
                om.role_key,
                case om.role
                  when 'admin' then 'company_admin'
                  when 'planner' then 'fpa_analyst'
                  when 'owner' then 'company_admin'
                  else 'viewer'
                end
              )
              and rp.permission_key = p_permission_key
          )
        )
      )
  );
$$;

revoke all on function public.has_org_permission(uuid, text) from public, anon;
grant execute on function public.has_org_permission(uuid, text) to authenticated;
