# Cash Forecast Engine

## Scope
Basic deterministic cash forecasting for the MVP.

## Model
- opening_cash
- cash_inflow
- cash_outflow
- financing
- closing_cash

Closing cash is calculated as opening cash + inflows - outflows + financing in the workspace UI. All amounts are stored in minor currency units.

## Security
- Tenant-scoped by organization.
- RLS enabled on `cash_forecast_lines`.
- Read requires organization `view` permission.
- Mutations require `manage_budget`.
- Forecast version must belong to the organization and be a draft for mutations.
- RPCs use `SECURITY DEFINER` with an empty pinned `search_path`.
- Anonymous access is revoked.

## Current limitation
The MVP entry layer is manual. Automatic cash drivers from AR/AP, sales, expenses, payroll, and advanced working-capital assumptions are deferred to the planning roadmap.

## UI
Route: `/workspace/cash`
