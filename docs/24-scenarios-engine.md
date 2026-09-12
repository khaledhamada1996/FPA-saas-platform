# Scenarios Engine

The MVP Scenarios Engine provides controlled what-if analysis over a planning version.

## Scenario types
- what_if
- upside
- downside
- stress

## Adjustments
Each scenario can contain period/account adjustments using either an absolute value or percentage.

## Security
- Organization isolation through RLS and `has_org_permission`.
- Scenario changes require `manage_budget`.
- Only draft scenarios can be changed.
- SECURITY DEFINER functions use an empty `search_path`.
- Anonymous access is denied.

## UI
`/workspace/scenarios`

The current MVP UI creates scenarios and records adjustments. A later enhancement can calculate full statement-level scenario outputs from the selected base version and surface the resulting KPIs side-by-side.