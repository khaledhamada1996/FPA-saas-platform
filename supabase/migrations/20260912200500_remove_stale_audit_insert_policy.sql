-- Direct audit event inserts are intentionally blocked; audit rows are written by the server-side audit boundary.
DROP POLICY IF EXISTS "members can create audit events for their organizations" ON public.audit_events;
