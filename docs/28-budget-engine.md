# Budget Engine

## Scope
The Budget Engine provides organization-scoped, versioned budget planning with deterministic line storage and the existing planning approval workflow.

## Data model
- `planning_versions`: budget version container and lifecycle.
- `budget_lines`: period/account budget amounts with optional legal entity, branch, department, cost center, region, product, and project dimensions.
- `financial_periods`: planning periods.
- `accounts`: chart of accounts.

Amounts are stored as integer minor units and currency is taken from the organization base currency.

## Lifecycle
Budget versions use the existing lifecycle:
`draft -> submitted -> changes_requested -> approved -> locked`.

A budget cannot be submitted unless it contains at least one budget line. Existing approval policy, segregation-of-duties, and role/permission checks remain authoritative.

## Security
- `budget_lines` has RLS enabled.
- Anonymous table access is revoked.
- Direct authenticated writes require `manage_budget`.
- Read access requires `view`.
- RPCs are `SECURITY DEFINER` with `search_path = ''` and explicit organization/version/dimension ownership checks.
- No production or sample financial data is created by the engine.

## RPC surface
- `get_budget_workspace(organization_id, planning_version_id)`
- `upsert_budget_line(...)`
- `delete_budget_line(organization_id, budget_line_id)`
- `get_budget_summary(organization_id, planning_version_id)`

## UI
`/workspace/budget` supports:
1. Creating a budget version.
2. Selecting an existing financial period and account.
3. Entering a budget amount and note.
4. Reviewing stored budget lines and totals.
5. Submitting the version to the existing approval workflow.
6. Reviewer approval, change request, or rejection.

If the organization has no financial periods or accounts, the UI intentionally does not create fake data and explains the prerequisite.
