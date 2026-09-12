# Production Seed Inventory

Captured from the live Supabase production schema on 2026-09-12.

## Configuration / seed state

- `organizations`: 1 row
- `organization_members`: 1 row
- `organization_permissions`: 16 rows
- `organization_roles`: 12 rows
- `organization_role_permissions`: 77 rows
- `dashboard_metric_definitions`: 0 rows
- `planning_approval_policies`: 0 rows
- `planning_approval_steps`: 0 rows

## Application meaning

The permission catalog and role templates are organization-scoped seed/configuration data and must be represented in any reproducible baseline.

The current production organization and its member are environment-specific data and must NOT be copied into a clean baseline migration.

The role-permission mappings are seeded configuration. Their UUID primary keys and timestamps are environment-specific and should not be treated as immutable application constants unless the schema contract requires them.

No dashboard metric definitions or planning approval policy/step rows currently exist in Production, so no seed rows are required for those tables at baseline time.

## Security note

No production user, organization identifier, membership identifier, or other environment-specific row is included in the repository. This document records counts and classification only.

## Baseline gate

Before Budget/Forecast implementation, the reproducible baseline must contain the required permission/role seed configuration and must explicitly exclude production tenant data.