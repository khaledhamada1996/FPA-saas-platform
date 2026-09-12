# Canonical Production Baseline Snapshot

**Status:** inventory captured; canonical SQL rebuild is not yet created.

## Purpose

This document records the current Production database shape as the authoritative reference while the repository migration history is reconciled. It is **not** a replacement for the missing historical migration bodies and must not be used to mark historical migrations as applied.

## Production reference

- Supabase project ref: `qnoulgkttxvnqdiisevv`
- Live migration ledger at audit time: 54 entries
- Current repository migration files at audit time: 29
- Exact historical filename/version parity: not established

## Public relations

The current public schema contains 30 relations: 29 tables and 1 view.

### Tables

- account_categories
- account_mappings
- accounts
- actuals_publish_batches
- audit_events
- branches
- cost_centers
- dashboard_metric_definitions
- departments
- financial_facts
- financial_periods
- import_rows
- imports
- legal_entities
- login_rate_limits
- notifications
- organization_member_permission_overrides
- organization_member_scopes
- organization_members
- organization_permissions
- organization_role_permissions
- organization_roles
- organizations
- planning_approval_policies
- planning_approval_steps
- planning_version_approval_steps
- planning_versions
- products
- projects
- regions

### View

- `actual_income_statement`

## Current security-critical functions

The Production inventory includes these security/application functions:

- `has_org_permission(uuid,text)`
- `has_org_data_scope(uuid,text,uuid)`
- `publish_actuals_from_import(uuid,text)`
- `ingest_validated_import(uuid,text,text,jsonb)`
- `create_workspace(text,text,smallint)`
- `create_workspace(text,text,smallint,jsonb)`
- `delete_workspace(uuid,text)`
- `get_my_workspaces()`
- `get_planning_workspace(uuid)`
- `create_planning_version(uuid,text,text)`
- `submit_planning_version(uuid)`
- `review_planning_version(uuid,text,text)`
- `configure_planning_approval_policy(uuid,text)`
- `get_planning_approval_policy(uuid)`
- `write_audit_event(uuid,text,text,text,jsonb,jsonb)`
- `audit_material_mutation()`
- `validate_account_mapping_approval_audit()`
- `is_org_member(uuid)`
- `is_org_admin(uuid)`

## Current material triggers

- `account_mappings_approval_audit_guard`
- `account_mappings_audit`
- `financial_facts_audit`
- `imports_audit`
- `organizations_set_updated_at`
- `planning_versions_audit`

## Security boundaries captured

### Authorization

`has_org_permission()` currently evaluates organization membership, explicit permission overrides, and role permissions. An explicit deny override suppresses the role grant; an explicit grant override authorizes the permission.

### Data scope

`has_org_data_scope()` is used by the `financial_facts_scoped_select` policy. A member without scope rows is treated as organization-wide; when scope assignments exist, matching scope IDs are required for constrained dimensions.

### Actuals publishing

`publish_actuals_from_import()` is a `SECURITY DEFINER` write boundary. Direct authenticated INSERT/UPDATE/DELETE access to `financial_facts` and `actuals_publish_batches` is not part of the intended client write surface.

### Audit

Direct authenticated/anonymous INSERT access to `audit_events` is revoked. Material mutations on `financial_facts`, `planning_versions`, `imports`, and `account_mappings` generate audit records through a server-side trigger boundary.

## Index inventory highlights

The Production schema contains primary/unique indexes plus organization-scoped indexes across the financial model. Notable integrity/idempotency indexes include:

- `financial_facts_org_source_row_key_uidx`
- `financial_facts_source_row_uidx`
- `imports_org_file_hash_uidx`
- `import_rows_organization_id_source_key_key`
- `account_mappings_organization_id_source_code_key`
- `organization_members_pkey`
- `organization_member_permission_overrides_pkey`
- `organization_member_scopes_pkey`
- `planning_versions_organization_id_version_type_name_key`

## Important implementation notes discovered during baseline capture

1. The repository cannot currently reproduce Production from its 29 migration files alone.
2. Historical migration SQL has been recovered from Git history for some deleted migrations, but those old migrations must not be blindly restored because the current security model has evolved.
3. The canonical rebuild should be a **new, explicit baseline** representing the approved current Production state after schema reconciliation. It must not falsify the 54-entry historical ledger.
4. Before creating the baseline SQL, capture exact Production DDL for extensions/types, columns/defaults, constraints, indexes, view definitions, RLS policies, grants, triggers, functions, and required seed/configuration rows.
5. No Production mutation is required to perform this baseline capture.
6. Tenant-isolation runtime tests remain pending because the Supabase project is on a plan that does not support development branches and no disposable test database has been provisioned.

## Next controlled step

Generate the exact canonical SQL from the captured Production catalog, review it against the current repository security migrations, and only then add a new baseline migration plus a clean-rebuild schema contract test. Do not apply that baseline to Production as a repair mechanism.
