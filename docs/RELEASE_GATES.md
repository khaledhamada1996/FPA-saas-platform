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

## Production database synchronization

The production project currently contains a long migration history. The final security/publish state is captured in `20260914141227_production_state_sync_20260914.sql` and the duplicate-index cleanup in `20260914141400_remove_duplicate_indexes.sql`.

Before the first clean production rebuild, run the Supabase CLI `db pull` against the linked production project and then verify a clean `db reset` locally. Do not mark migrations as applied merely to hide drift. The resulting remote schema must be the source used to complete the canonical baseline.

## Authentication hardening

Supabase Security Advisor currently reports leaked-password protection as a project-level Auth setting. Enable leaked-password protection in the Supabase Auth configuration before public production launch.

## Test data

The published `FPA_Journal_Entries_Test_5000.xlsx` import is retained only as a controlled verification dataset until a dedicated rollback/cleanup operation is executed. Do not delete `financial_facts` directly. Use the application/database rollback workflow so audit and lineage remain consistent.
