# MVP Scope

## Objective

Validate that companies can move from imported financial data to a usable budget, forecast, performance analysis, cash outlook, and decision-support experience.

## Included

### Foundation
- Multi-tenant organization workspace.
- Authentication and organization membership.
- Initial RBAC.
- Company configuration.

### Data
- Excel/CSV import.
- Import validation.
- Basic mapping to the financial model.
- Import history.

### Financial Model
- Core P&L model.
- Basic balance-sheet and cash-flow structures where required by MVP flows.
- Monthly periods.
- Key organizational dimensions.

### Planning
- Budget creation.
- Budget version.
- Forecast creation.
- Forecast version.
- Basic assumptions.

### Analysis
- Actual vs Budget.
- Actual vs Forecast.
- Basic variance analysis.
- Core KPI dashboard.
- Basic cash forecast.
- Basic scenario/what-if analysis.

### AI
- Grounded financial Q&A over authorized MVP data.
- Variance explanation.
- Management summary.

### Governance
- Basic audit log.
- Basic approval/status model for important planning artifacts.

## Deferred from MVP

- Deep ERP integrations.
- Full consolidation engine.
- Enterprise SSO.
- Advanced driver library.
- Advanced predictive forecasting.
- Full board-pack automation.
- Complex workflow designer.
- Extensive custom dimensions.
- Billing automation if commercial validation is performed before implementation.

## MVP Success Criteria

A test company should be able to:

1. Create a workspace.
2. Import representative financial data.
3. Map and validate the data.
4. See actual financial performance.
5. Build a budget.
6. Create a forecast.
7. Compare actuals with budget/forecast.
8. Run a scenario.
9. Review cash outlook.
10. Ask the AI analyst why performance changed and receive a data-grounded answer.
