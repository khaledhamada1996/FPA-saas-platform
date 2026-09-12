# Migration Drift Resolution

## Status
P0 release blocker.

The production Supabase project currently reports 54 applied migrations, while the GitHub `supabase/migrations` directory does not contain the complete historical migration chain.

This means the repository is not yet a reproducible source of the production database schema.

## Confirmed production migration ledger

The production migration history includes these versions that are not represented by identically named files in the repository history:

- 20260910200756 initial_schema
- 20260910200835 tenant_rls
- 20260910200854 login_rate_limit
- 20260910201003 foundation
- 20260910201015 tenant_rls
- 20260910201024 workspace_rpc
- 20260910201038 login_rate_limit
- 20260910201104 security_hardening
- 20260910201125 function_privileges_hardening
- 20260910201507 fix_login_rate_limit_ambiguity
- 20260910201813 login_rate_limit_fix
- 20260910215558 fpa_master_model
- 20260910224110 fpa_actuals_model
- 20260910225134 financial_period_engine
- 20260910225335 account_master_constraints
- 20260911085834 actuals_publish_rpc
- 20260911085915 actuals_read_rls
- 20260911104221 tenant_read_policies_actuals_import
- 20260911125454 journal_entry_import_accuracy
- 20260911135954 harden_financial_core_and_tenant_security_v2
- 20260911140016 enforce_workspace_admin_mutations
- 20260911141731 financial_facts_canonical_account_classification
- 20260911171251 fpa_phase_2_tenant_consistency
- 20260911180137 actuals_mapping_publish_foundation
- 20260911180553 publish_actuals_from_import_rows
- 20260911180649 complete_actuals_publish_from_import_rows
- 20260911181235 secure_import_ingestion_policies
- 20260911181308 atomic_import_ingestion_rpc
- 20260911181541 fix_import_validation_regex
- 20260911181620 validate_import_calendar_dates
- 20260911200324 add_company_profile_onboarding
- 20260912081934 identity_access_roles_permissions_foundation_v2
- 20260912081949 workspace_creation_identity_access_defaults
- 20260912083501 fix_workspace_membership_loading
- 20260912084437 secure_company_deletion_confirmation
- 20260912092459 harden_publish_actuals_permission
- 20260912092917 disable_legacy_publish_actual_import
- 20260912092944 harden_import_rls_permissions
- 20260912093011 harden_import_read_and_ingest_permissions
- 20260912093055 tighten_import_mapping_table_grants
- 20260912093334 secure_publish_write_boundary
- 20260912094433 secure_import_write_boundary
- 20260912094518 enforce_import_publish_state
- 20260912095045 harden_mapping_approval_audit
- 20260912100408 add_configurable_planning_approval_workflow_v2
- 20260912100434 implement_planning_approval_workflow
- 20260912100549 add_planning_notifications_access
- 20260912100615 fix_planning_review_reject_permission
- 20260912110841 secure_planning_ui_read_and_create
- 20260912110855 include_planning_approval_steps_in_ui_read
- 20260912142721 revoke_unneeded_function_execute
- 20260912142733 close_is_org_admin_execute_surface
- 20260912142824 remove_legacy_actual_import_surface
- 20260912142916 sync_permission_override_evaluator
- 20260912143432 enforce_scoped_financial_access_and_audit_boundary
- 20260912143505 tighten_audit_table_grants

## Important naming mismatch

The repository contains later migration filenames with timestamps that do not match the production migration ledger, for example:

- `20260912120000_harden_permission_evaluator.sql`
- `20260912121000_harden_import_rls_permissions.sql`
- `20260912122000_harden_publish_actuals_permission.sql`
- `20260912124000_harden_import_read_and_ingest_permissions.sql`
- `20260912124000_secure_publish_write_boundary.sql`
- `20260912125000_tighten_import_mapping_table_grants.sql`
- `20260912130000_secure_import_write_boundary.sql`
- `20260912131000_enforce_import_publish_state.sql`
- `20260912135000_add_configurable_planning_approval_workflow.sql`
- `20260912141000_implement_planning_approval_workflow.sql`
- `20260912142000_add_planning_notifications_access.sql`
- `20260912143000_fix_planning_review_reject_permission.sql`
- `20260912143000_secure_planning_ui_read_and_create.sql`
- `20260912170000_close_unneeded_function_execute_surface.sql`
- `20260912171000_remove_legacy_actual_import_surface.sql`
- `20260912172000_sync_permission_override_evaluator.sql`
- `20260912173500_enforce_scoped_financial_access_and_audit_boundary.sql`
- `20260912174000_tighten_audit_table_grants.sql`

These must not simply be renamed or deleted. Their SQL represents real schema/security changes already applied to production and must remain represented in the repository history.

## Recovery policy

1. Do not reset or recreate Production.
2. Do not manually mark migrations as applied merely to silence drift.
3. Do not delete historical migration files to make filenames look clean.
4. First reconstruct the complete production migration chain in GitHub from the actual applied history and verify each migration's effect.
5. Preserve all security hardening already deployed.
6. Only after the repository can rebuild the schema from zero should local tenant-isolation integration tests be considered authoritative.
7. After recovery, enforce a single migration workflow: every database DDL change is committed as a migration before or together with production deployment.

## Next implementation step

Recover the missing early migration files and reconcile the timestamp/name mismatches. Then run a clean local database rebuild from the repository and execute `supabase/tests/tenant_isolation.sql` against that disposable database.
