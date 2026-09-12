# Forecast Engine

## Purpose
The Forecast Engine provides a controlled planning workspace for financial forecasts by organization, planning version, financial period, account, and optional dimensions.

## Database
- `public.forecast_lines`
- `planning_versions` with `version_type = 'forecast'`
- Amounts are stored as integer minor units (`amount_minor`).
- A unique constraint prevents duplicate forecast lines for the same version, period, account, and dimension combination.

## RPCs
- `get_forecast_workspace(uuid, uuid)`
- `upsert_forecast_line(uuid, uuid, uuid, uuid, bigint, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text)`
- `delete_forecast_line(uuid, uuid)`

The workspace RPC returns the selected forecast version plus organization periods, accounts, and forecast lines.

## Workflow
1. Create a forecast planning version.
2. Add forecast lines by period and account.
3. Submit the version through the existing planning approval workflow.
4. Approved forecasts become the controlled planning baseline for downstream variance analysis.

## Security
- RLS is enabled on `forecast_lines`.
- View access requires organization view permission.
- Mutations require budget-management permission and draft/changes-requested status.
- Forecast RPCs are `SECURITY DEFINER` with an empty pinned `search_path`.
- Anonymous table access is revoked; authenticated users receive only the required RPC/table privileges.
- Organization, period, account, and planning-version ownership are validated server-side.

## UI
`/workspace/forecast` provides the Arabic RTL forecast workspace, version lifecycle controls, line entry, deletion, submission, and review actions.

## Data policy
No production or fake financial data is inserted by the engine. Empty periods/accounts are surfaced as a setup dependency.
