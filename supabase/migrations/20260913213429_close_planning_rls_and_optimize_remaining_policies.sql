-- RPC-only planning tables: keep direct PostgREST access closed while avoiding RLS-without-policy exposure.
create policy planning_drivers_deny_all on public.planning_drivers for all to public using (false) with check (false);
create policy planning_driver_values_deny_all on public.planning_driver_values for all to public using (false) with check (false);

-- Optimize auth.uid() evaluation so it is initialized once per statement.
drop policy if exists organization_member_permission_overrides_select on public.organization_member_permission_overrides;
create policy organization_member_permission_overrides_select on public.organization_member_permission_overrides for select to authenticated using (has_org_permission(organization_id, 'manage_users'::text) or (user_id = (select auth.uid())));

drop policy if exists organization_member_scopes_member_select on public.organization_member_scopes;
create policy organization_member_scopes_member_select on public.organization_member_scopes for select to authenticated using (exists (select 1 from public.organization_members om where om.organization_id = organization_member_scopes.organization_id and om.user_id = (select auth.uid())));

drop policy if exists "members can read memberships in their organizations" on public.organization_members;
create policy "members can read memberships in their organizations" on public.organization_members for select to authenticated using ((user_id = (select auth.uid())) or is_org_member(organization_id));

drop policy if exists organization_role_permissions_member_select on public.organization_role_permissions;
create policy organization_role_permissions_member_select on public.organization_role_permissions for select to authenticated using (exists (select 1 from public.organization_members om where om.organization_id = organization_role_permissions.organization_id and om.user_id = (select auth.uid())));

drop policy if exists organization_roles_member_select on public.organization_roles;
create policy organization_roles_member_select on public.organization_roles for select to authenticated using (exists (select 1 from public.organization_members om where om.organization_id = organization_roles.organization_id and om.user_id = (select auth.uid())));

-- Remove exact duplicate non-unique indexes; keep the unique constraint index on import_rows.
drop index if exists public.import_audit_events_import_idx;
drop index if exists public.import_rows_import_idx;
