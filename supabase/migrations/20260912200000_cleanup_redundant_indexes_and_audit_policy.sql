-- Safe cleanup of exact duplicate uniqueness and stale audit INSERT policy.
-- Keep canonical UNIQUE constraints and remove only redundant standalone indexes.
-- financial_periods_org_start_uq is intentionally preserved because it is not an exact duplicate.

ALTER TABLE public.account_categories
  DROP CONSTRAINT IF EXISTS account_categories_org_name_unique;

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_org_code_unique;

DROP INDEX IF EXISTS public.organizations_id_org_uidx;

DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
DROP POLICY IF EXISTS audit_events_authenticated_insert ON public.audit_events;
DROP POLICY IF EXISTS audit_events_member_insert ON public.audit_events;
