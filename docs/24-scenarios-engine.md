# Scenarios Engine

The MVP Scenarios Engine provides controlled what-if analysis over an approved or draft budget/forecast planning version.

## Scenario types
- what_if
- upside
- downside
- stress

## Adjustments
Each scenario contains period/account adjustments using either:
- `percentage`: percentage change applied to the base amount
- `absolute`: SAR amount added to the base amount

An account is required for each adjustment to keep the scenario calculation deterministic.

## Results
`get_scenario_results` calculates, from the selected budget or forecast version:
- base and scenario revenue
- base and scenario COGS
- base and scenario gross profit
- base and scenario operating expenses
- base and scenario EBITDA
- scenario finance cost
- scenario tax
- scenario net income
- account-level base, adjustment, and scenario values

The calculation follows the same account-type conventions used by the Financial Statements engine.

## Security
- Organization isolation through RLS and `has_org_permission`.
- Scenario changes require `manage_budget`.
- Only draft scenarios can be changed.
- SECURITY DEFINER functions use an empty `search_path`.
- Anonymous access is denied.

## UI
`/workspace/scenarios`

The UI requires a base budget/forecast version, allows controlled adjustments, and exposes calculated scenario KPIs plus account-level adjustments.