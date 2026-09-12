-- These tables are intentionally RPC-only. Keep RLS enabled and make direct PostgREST access explicit-deny.
-- SECURITY DEFINER RPCs remain the controlled application boundary.

create policy dashboard_metric_definitions_rpc_only on public.dashboard_metric_definitions
  for all to public using (false) with check (false);

create policy import_audit_events_rpc_only on public.import_audit_events
  for all to public using (false) with check (false);

create policy import_reconciliations_rpc_only on public.import_reconciliations
  for all to public using (false) with check (false);

create policy organization_invitations_rpc_only on public.organization_invitations
  for all to public using (false) with check (false);

create policy planning_approval_policies_rpc_only on public.planning_approval_policies
  for all to public using (false) with check (false);

create policy planning_approval_steps_rpc_only on public.planning_approval_steps
  for all to public using (false) with check (false);

create policy planning_version_approval_steps_rpc_only on public.planning_version_approval_steps
  for all to public using (false) with check (false);

create policy planning_versions_rpc_only on public.planning_versions
  for all to public using (false) with check (false);

-- Notifications are intentionally readable by their recipient through PostgREST.
-- Writes remain behind server-side RPCs.
create policy notifications_recipient_select on public.notifications
  for select to authenticated
  using (recipient_user_id = (select auth.uid()));

revoke insert, update, delete on public.notifications from authenticated, anon;
