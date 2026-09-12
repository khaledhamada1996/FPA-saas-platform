# Production Security Inventory

Date: 2026-09-12

## Verified production state

All public base tables currently have RLS enabled. The principal material write boundaries are implemented through SECURITY DEFINER RPCs and restricted table grants.

### Financial write boundary
- `financial_facts`: authenticated SELECT only; no authenticated direct INSERT/UPDATE/DELETE grant.
- `publish_actuals_from_import(uuid,text)`: SECURITY DEFINER, authenticated execution, anonymous execution revoked; requires `import` permission.
- `financial_facts` has an audit trigger.

### Import boundary
- `imports`: authenticated INSERT/SELECT/UPDATE surfaces are constrained by RLS and `import` permission.
- `import_rows`: authenticated INSERT/SELECT surfaces are constrained by RLS and `import` permission.
- `ingest_validated_import(...)`: SECURITY DEFINER and explicitly requires `import` permission.

### Planning boundary
- `create_planning_version(...)`: requires `manage_budget`.
- `submit_planning_version(...)`: requires `submit` and creator ownership.
- `review_planning_version(...)`: separates `approve` from `reject` / `changes_requested` permissions and validates workflow role assignment.
- Planning UI reads use secure RPCs rather than direct table writes.

### Audit boundary
- Material mutation triggers exist on `financial_facts`, `planning_versions`, `imports`, and `account_mappings`.
- Direct authenticated/anonymous INSERT into `audit_events` is revoked at the grant layer.
- `write_audit_event(...)` is the explicit RPC boundary.

## Findings requiring later hardening

1. Several tables contain duplicate/redundant indexes with equivalent uniqueness definitions. These should be reviewed and removed only after confirming no dependency.
2. Legacy `public` SELECT policies remain on several master tables (`accounts`, `branches`, `cost_centers`, `departments`, `financial_periods`, `legal_entities`, `products`, `projects`, `regions`). Because the policies are scoped through membership checks they are not automatically insecure, but their role target should be normalized to `authenticated` for clarity and least privilege.
3. `audit_events` still has a historical INSERT RLS policy even though the authenticated/anonymous table INSERT grant has been revoked. The policy should be removed as dead security surface after verifying no supported direct-insert workflow remains.
4. SECURITY DEFINER functions using `SET search_path TO 'public', 'pg_temp'` should eventually be migrated to an empty search path with fully qualified references where practical.
5. `audit_material_mutation()` stores complete before/after row JSON. This should be reviewed for payload size and sensitive-data exposure before high-volume financial data is enabled.

No Production schema changes are made by this document.