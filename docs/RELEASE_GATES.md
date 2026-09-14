# Release Gates

This repository treats the FP&A workspace as one canonical application surface.

## Required gates

1. `bun run typecheck`
2. `bun run build`
3. `bun run test:e2e`
4. Database migrations are version-controlled under `supabase/migrations/`.
5. Production-only database changes must be captured before the next release.
6. Tenant authorization is enforced both by workspace route checks and database authorization/RLS.
7. Publish flow is strictly: import → mapping draft → review/approval → prepare → reconcile → publish.
8. Published actuals are immutable through the normal import path; rollback uses the dedicated rollback workflow.
9. No second dashboard/RBAC shell may be introduced under `/dashboard`.
10. Foreign keys must have appropriate covering indexes; Supabase performance advisor must not report unindexed foreign keys.
11. Republish of a published import must fail without changing `financial_facts`.

## Production database synchronization

The production project contains a long migration history. The final security/publish state is captured in `20260914141227_production_state_sync_20260914.sql`, duplicate-index cleanup in `20260914141312_remove_duplicate_indexes.sql`, and foreign-key indexing in `20260914195226_add_missing_foreign_key_indexes.sql`.

Before the first clean production rebuild, run the Supabase CLI `db pull` against the linked production project and then verify a clean `db reset` locally. Do not mark migrations as applied merely to hide drift. Supabase documents `db pull` as the baseline workflow for an existing remote project and `db reset` as the reproducibility check. The resulting remote schema must be the source used to complete the canonical baseline.

## Authentication hardening

Supabase Security Advisor currently reports leaked-password protection as a project-level Auth setting. This is a hosted Supabase Auth configuration and is not exposed through the database migration API used by this repository. Enable leaked-password protection in the Supabase Auth password-security configuration before public production launch.

## Test data

The published `FPA_Journal_Entries_Test_5000.xlsx` import is retained only as a controlled verification dataset until a dedicated rollback/cleanup operation is executed. Do not delete `financial_facts` directly. Use the application/database rollback workflow so audit and lineage remain consistent.

## Regression tests

`supabase/tests/publish_idempotency.sql` verifies that attempting to publish an already-published import fails and does not change its financial facts. The Playwright smoke suite also verifies authentication redirects, the legacy dashboard redirect-only boundary, and the chart-of-accounts compatibility route.
