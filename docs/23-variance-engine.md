# Variance Engine

## Purpose
Deterministic Actual vs Budget vs Forecast analysis for an organization and financial period.

## Authority
- Actuals: published `financial_facts` only.
- Budget: approved `planning_versions` of type `budget` only.
- Forecast: optional approved `planning_versions` of type `forecast` only.
- No AI or inferred values are used.

## RPC
`public.get_variance_analysis(p_organization_id, p_period_id, p_budget_version_id, p_forecast_version_id)`

Returns account-level rows and executive metrics for Revenue, COGS, Gross Profit, OpEx and EBITDA.

Variance is calculated as Actual minus Budget. Variance percentage is calculated against the absolute Budget amount; zero-budget percentages are returned as null.

## Security
The RPC is `SECURITY DEFINER`, uses an empty `search_path`, requires an authenticated user with organization `view` permission, validates organization ownership of the selected period and requires approved planning versions. Anonymous execution is revoked.

## UI
`/workspace/variance`

The workspace lets the user select a financial period, an approved budget and optionally an approved forecast, then displays executive metrics and account-level variance detail.

No production or demo data is created by the engine.
