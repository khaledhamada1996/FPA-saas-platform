create or replace function public.has_org_permission(p_organization_id uuid,p_permission_key text)
returns boolean
language sql
security definer
set search_path=''
set row_security='off'
as $$
  select exists(
    select 1
    from public.organization_members om
    join public.organization_member_permission_overrides po
      on po.organization_id=om.organization_id
     and po.user_id=om.user_id
    where om.organization_id=p_organization_id
      and om.user_id=(select auth.uid())
      and (select auth.uid()) is not null
      and om.permissions_initialized=true
      and po.permission_key=p_permission_key
      and po.granted=true
  );
$$;
