# Migration Ledger Audit

Date: 2026-09-12

## Scope

This audit compares the live Supabase migration ledger for project `qnoulgkttxvnqdiisevv` with the migration files currently tracked on `main`.

## Result

- Live Supabase migration records: **54**
- GitHub migration files on `main`: **29**
- Exact version+name matches: **0**
- Logical-name matches with a different version prefix: **most of the 29 current files**
- Live migration records with no corresponding current GitHub filename/version: **25+**
- Some historical SQL was recovered from earlier GitHub commits, but it is **not safe to assume that historical SQL is byte-for-byte identical to the SQL recorded in the live migration ledger**.

## Live migration ledger

```text
20260910200756 initial_schema
20260910200835 tenant_rls
20260910200854 login_rate_limit
20260910201003 foundation
20260910201015 tenant_rls
20260910201024 workspace_rpc
20260910201038 login_rate_limit
20260910201104 security_hardening
20260910201125 function_privileges_hardening
20260910201507 fix_login_rate_limit_ambiguity
20260910201813 login_rate_limit_fix
20260910215558 fpa_master_model
20260910224110 fpa_actuals_model
20260910225134 financial_period_engine
20260910225335 account_master_constraints
20260911085834 actuals_publish_rpc
20260911085915 actuals_read_rls
20260911104221 tenant_read_policies_actuals_import
20260911125454 journal_entry_import_accuracy
20260911135954 harden_financial_core_and_tenant_security_v2
20260911140016 enforce_workspace_admin_mutations
20260911141731 financial_facts_canonical_account_classification
20260911171251 fpa_phase_2_tenant_consistency
20260911180137 actuals_mapping_publish_foundation
20260911180553 publish_actuals_from_import_rows
20260911180649 complete_actuals_publish_from_import_rows
20260911181235 secure_import_ingestion_policies
20260911181308 atomic_import_ingestion_rpc
20260911181541 fix_import_validation_regex
20260911181620 validate_import_calendar_dates
20260911200324 add_company_profile_onboarding
20260912081934 identity_access_roles_permissions_foundation_v2
20260912081949 workspace_creation_identity_access_defaults
20260912083501 fix_workspace_membership_loading
20260912084437 secure_company_deletion_confirmation
20260912092459 harden_publish_actuals_permission
20260912092917 disable_legacy_publish_actual_import
20260912092944 harden_import_rls_permissions
20260912093011 harden_import_read_and_ingest_permissions
20260912093055 tighten_import_mapping_table_grants
20260912093334 secure_publish_write_boundary
20260912094433 secure_import_write_boundary
20260912094518 enforce_import_publish_state
20260912095045 harden_mapping_approval_audit
20260912100408 add_configurable_planning_approval_workflow_v2
20260912100434 implement_planning_approval_workflow
20260912100549 add_planning_notifications_access
20260912100615 fix_planning_review_reject_permission
20260912110841 secure_planning_ui_read_and_create
20260912110855 include_planning_approval_steps_in_ui_read
20260912142721 revoke_unneeded_function_execute
20260912142733 close_is_org_admin_execute_surface
20260912142824 remove_legacy_actual_import_surface
20260912142916 sync_permission_override_evaluator
20260912143432 enforce_scoped_financial_access_and_audit_boundary
20260912143505 tighten_audit_table_grants
```

## Current GitHub migration set

The current `main` branch contains 29 migration files. Several use different timestamps from the live ledger even where the logical migration name is the same. Examples:

- `actuals_mapping_publish_foundation`
- `publish_actuals_from_import_rows`
- `secure_import_ingestion_policies`
- `atomic_import_ingestion_rpc`
- `fix_import_validation_regex`
- `validate_import_calendar_dates`
- `fpa_phase_2_tenant_consistency`
- `add_company_profile_onboarding`
- `harden_publish_actuals_permission`
- `disable_legacy_publish_actual_import`
- `harden_import_rls_permissions`
- `harden_import_read_and_ingest_permissions`
- `tighten_import_mapping_table_grants`
- `secure_publish_write_boundary`
- `secure_import_write_boundary`
- `enforce_import_publish_state`
- planning approval/read migrations
- recent authorization/audit migrations

These are useful source artifacts, but they do not repair the migration ledger mismatch by themselves.

## Historical recovery evidence

Before the repository reset, Git history contained the following migration files:

- `20260910150000_fpa_core.sql`
- `20260910153000_tenant_rls.sql`
- `20260911160000_harden_financial_core_and_tenant_security.sql`
- `20260911173000_financial_facts_canonical_account_classification.sql`

The reset commit removed those historical migration files. Their exact historical contents remain recoverable from Git history. However, because the live Supabase ledger has different version identifiers and later migration revisions, these files must be compared against the actual live schema before being considered authoritative replacements.

## Critical conclusion

**Do not create synthetic replacement migrations and do not mark missing migrations as applied merely to make the ledger appear clean.**

The correct recovery sequence is:

1. Preserve the live migration ledger as the authoritative execution order.
2. Recover historical SQL from Git history wherever it exists.
3. Identify which live migrations were created outside the repository or were subsequently rewritten/renamed.
4. Reconstruct the missing SQL from authoritative history or an approved database schema export.
5. Only after exact SQL recovery, add migrations to Git using their original version prefixes.
6. Run a clean local rebuild and compare tables, columns, constraints, functions, policies, grants, triggers, and extensions.
7. Do not alter production solely to hide migration drift.

## Current blocker

The Supabase migration listing exposes the live migration version/name ledger but does not expose the historical SQL body. GitHub contains some historical SQL, but not all 54 live migration bodies. Therefore the remaining missing migration SQL cannot be safely fabricated from current schema inspection.

This is a **release blocker for a reproducible clean rebuild**, but it does not require changing the production database at this stage.
