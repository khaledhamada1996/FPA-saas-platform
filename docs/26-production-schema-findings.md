# Production Schema Findings

## Index findings

Production has several exact duplicate unique indexes that should be treated as cleanup candidates, not immediately dropped:

- `account_categories`: `account_categories_org_name_unique` duplicates `account_categories_organization_id_name_key`.
- `accounts`: `accounts_org_code_unique` duplicates `accounts_organization_id_code_key`.
- `financial_periods`: `financial_periods_org_start_uq` and `financial_periods_organization_id_period_start_period_end_key` overlap but are not identical; retain until usage is understood.
- `organizations`: `organizations_id_org_uidx` duplicates the primary-key uniqueness on `id`.

Other indexes provide explicit tenant, dimension, import idempotency, and query-path support and should not be removed during baseline reconstruction.

## RLS findings

All current public base tables have RLS enabled.

Important normalization candidates:

- Several older SELECT policies target `public` rather than `authenticated` while still checking `auth.uid()` membership. Normalize these to `authenticated` in a later hardening migration after regression tests.
- `audit_events` has a historical INSERT policy even though table INSERT grants were revoked. Remove the obsolete policy only after confirming the RPC/trigger boundary is the only supported write path.

## Authorization findings

Current financial fact access uses `financial_facts_scoped_select` and the `has_org_data_scope()` helper.

Current permission evaluation uses explicit grant overrides, explicit deny overrides, then organization role permissions when no override exists.

Current import and actuals publishing paths enforce the `import` permission at the server-side boundary.

## Types/extensions

The catalog query found no custom public enum or domain types. The composite types shown by PostgreSQL are the automatic row types for public relations, not application-defined custom types.

The extension inventory still needs to be captured separately before the canonical SQL baseline is declared complete.

## Baseline rule

These findings are observations of Production. They are not permission to alter Production. Cleanup must be implemented as reviewed, isolated migrations after the canonical baseline is reproducible.