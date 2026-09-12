-- Safe cleanup of exact duplicate uniqueness and stale audit INSERT policy.
-- Do not remove financial_periods_org_start_uq: it is not an exact duplicate.

DROP INDEX IF EXISTS public.account_categories_org_name_unique;
DROP INDEX IF EXISTS public.accounts_org_code_unique;
DROP INDEX IF EXISTS public.organizations_id_org_uidx;

DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
DROP POLICY IF EXISTS audit_events_authenticated_insert ON public.audit_events;
DROP POLICY IF EXISTS audit_events_member_insert ON public.audit_events;
