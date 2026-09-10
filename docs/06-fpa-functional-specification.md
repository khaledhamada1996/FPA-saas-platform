# FP&A Functional Specification

## Financial Model

### Income Statement
Revenue → COGS → Gross Profit → Operating Expenses → EBITDA → D&A → EBIT → Finance Cost → EBT → Tax → Net Income.

### Balance Sheet
Cash, AR, inventory, other assets, AP, debt, other liabilities, and equity, with extensibility for additional accounts.

### Cash Flow
Operating, investing, and financing cash flows. Forecasting must support opening cash and projected closing cash.

### Planning Dimensions
The model should support dimensions such as entity, branch, department, cost center, region, product, project, and custom dimensions where technically appropriate.

## Budgeting

Budgets may be annual with monthly detail or directly monthly. Users can enter values, use historical baselines, apply growth assumptions, or calculate from operational drivers.

Budget versions require a status and owner. Approved versions become immutable or require explicit versioning for changes.

## Forecasting

Forecasts should support:

- Rolling periods.
- Historical actuals.
- Growth assumptions.
- Seasonality.
- Driver-based formulas.
- Management overrides.
- Version comparison.

The system must distinguish actuals from assumptions and forecast values.

## Driver-Based Planning Examples

- SaaS: Customers × ARPU = Revenue.
- Restaurant: Transactions × Average Ticket = Sales.
- Manufacturing: Units × Selling Price = Revenue.
- Services: Billable Hours × Rate = Revenue.

Driver formulas must be configurable and traceable.

## Variance Analysis

For each material variance, display:

- Actual.
- Comparison value.
- Absolute variance.
- Percentage variance where meaningful.
- Direction.
- Relevant dimensions.
- Potential driver decomposition where supported.

## Scenario Analysis

A scenario is a versioned set of assumptions applied to a selected baseline. Outputs may include revenue, gross profit, EBITDA, net income, cash flow, working capital, and funding requirement.

## KPI Engine

Industry templates may include retail, manufacturing, SaaS, and services KPIs. Organizations can define custom KPIs with a name, formula, unit, frequency, dimensions, and threshold rules.

## Cash Forecast

Minimum formula:

`Opening Cash + Expected Collections - Expected Payments + Financing - Capex = Closing Cash`

Cash alerts should identify projected deficits or configurable threshold breaches.

## Calculations

Financial calculations should be deterministic and performed by the application/domain calculation layer. AI may explain calculated outputs but must not become the authoritative calculation engine for core financial metrics.
