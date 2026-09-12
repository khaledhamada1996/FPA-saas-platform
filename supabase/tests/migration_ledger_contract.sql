-- Migration ledger contract test.
-- Run only against a disposable/local database.
-- This intentionally fails until the GitHub migration history is reconstructed
-- to match the production migration ledger documented in docs/21-migration-drift-resolution.md.

select
  case
    when count(*) = 54 then true
    else false
  end as production_ledger_expected_count
from supabase_migrations.schema_migrations;

-- The final production migration versions must exist in the database after a clean rebuild.
select version
from supabase_migrations.schema_migrations
where version in (
  '20260912143432',
  '20260912143505'
)
order by version;

-- A clean rebuild must contain the security-critical objects introduced by the
-- current production hardening work.
select to_regclass('public.organization_member_scopes') as organization_member_scopes;
select to_regclass('public.audit_events') as audit_events;
select to_regclass('public.financial_facts') as financial_facts;

select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'has_org_permission',
    'has_org_data_scope',
    'publish_actuals_from_import',
    'write_audit_event',
    'audit_material_mutation'
  )
order by proname;
