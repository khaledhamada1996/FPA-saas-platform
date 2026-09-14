drop policy if exists "organization_member_permission_overrides_select" on public.organization_member_permission_overrides;
create policy "organization_member_permission_overrides_select"
on public.organization_member_permission_overrides
for select
using (
  (select public.has_org_permission(organization_id,'manage_users'))
  or user_id=(select auth.uid())
);

drop policy if exists "members can read memberships in their organizations" on public.organization_members;
create policy "members can read memberships in their organizations"
on public.organization_members
for select
using (
  user_id=(select auth.uid())
  or (select public.is_org_member(organization_id))
);
