# Domain Financial Model

## 1. Purpose

This document defines the canonical financial data model used by actuals, budgets, forecasts, scenarios, analytics, cash planning, KPIs, and the AI analyst.

The model is designed to preserve financial correctness, reproducibility, dimensional analysis, versioning, and future multi-currency support.

## 2. Canonical Financial Fact

The platform should represent normalized monetary facts using a governed fact model rather than treating uploaded spreadsheets as the source of truth.

A financial fact conceptually contains:

- organization_id
- legal_entity_id where applicable
- financial_period_id
- account_id
- dimension references: branch, department, cost center, region, product, project, and future custom dimensions
- currency_code
- amount
- fact_type
- source_reference
- created_at / updated_at

`fact_type` must distinguish at minimum:

- actual
- adjustment
- budget
- forecast
- scenario

Planning facts must additionally reference their owning version. Actual facts reference the source/import or controlled adjustment that created them.

## 3. Period Model

Financial periods are first-class records.

Each period must contain:

- fiscal year
- period number
- start date
- end date
- status

Recommended statuses:

- open
- under_review
- closed
- locked

The application must never infer fiscal periods only from display labels such as `Jan-27`.

## 4. Actuals

Actuals represent published historical financial performance from approved source data and controlled adjustments.

Actuals are immutable after period lock except through an explicit adjustment/reopening process with audit logging.

Repeated imports must be idempotent according to a deterministic source/import identity strategy.

## 5. Budget

A budget consists of a logical budget and one or more versions.

Example:

- Budget 2027
  - v1 Draft
  - v2 Revised
  - Approved

Budget lines reference:

- budget_version
- period
- account or planning metric
- applicable dimensions
- amount or driver formula
- assumption metadata where applicable

Approved budget versions are immutable. Changes create a new version or a controlled adjustment according to the governance policy.

## 6. Forecast

Forecasts follow the same versioned principle as budgets.

A forecast version must identify:

- forecast horizon
- baseline/actual cut-off
- assumptions
- owner
- status
- creation/update timestamps

Forecast values must remain distinguishable from actuals and budget values.

## 7. Scenarios

A scenario is not a replacement for the baseline. It is a versioned projection derived from a selected baseline plus explicit assumption changes.

Examples:

- Base Case
- Best Case
- Downside Case
- New Branch Scenario

Scenario calculations must be reproducible from their baseline reference and stored assumptions.

## 8. Dimensions

The core dimensional model supports:

- legal entity
- branch
- department
- cost center
- region
- product
- project

Custom dimensions may be added later through a controlled extensibility mechanism.

Every fact should use nullable dimension references where the dimension is not applicable rather than inventing placeholder entities.

## 9. Account Model

Source accounts are mapped into governed account categories.

The minimum reporting hierarchy is:

Revenue → COGS → Gross Profit → Operating Expenses → EBITDA → D&A → EBIT → Finance Cost → EBT → Tax → Net Income

Balance-sheet and cash-flow classifications must also be represented so that statements and cash analysis do not depend on presentation-only labels.

## 10. Currency

The MVP must require an organization reporting/base currency.

The schema must remain capable of supporting:

- transaction/source currency
- reporting currency
- FX rate
- FX rate date
- converted reporting amount

Full multi-currency translation can remain outside MVP, but currency must never be hard-coded into application logic.

Monetary values require fixed precision and explicit rounding rules. Floating-point arithmetic must not be used for authoritative monetary calculations.

## 11. Calculation Rules

Core calculations are deterministic.

Examples:

- Gross Profit = Revenue - COGS
- EBITDA = Gross Profit - Operating Expenses
- EBIT = EBITDA - D&A
- EBT = EBIT - Finance Cost
- Net Income = EBT - Tax
- Closing Cash = Opening Cash + Collections - Payments + Financing - Capex

The calculation layer must define sign conventions explicitly and apply them consistently.

## 12. Actual vs Plan Semantics

Every analytical query must know which measure it is comparing.

Supported comparison types:

- Actual vs Budget
- Actual vs Forecast
- Forecast vs Budget
- Scenario vs Baseline

The system must never mix actual, budget, forecast, and scenario values silently.

## 13. Source Traceability

Every normalized fact must be traceable to its source where applicable:

`Source File/Import → Mapping Version → Normalized Fact → Model Output`

This traceability is required for reconciliation, audit, variance investigation, and AI explanations.

## 14. Design Decision

The canonical financial model is the system-of-record representation for FP&A analysis. Raw imported rows remain preserved as source evidence but are not directly used as authoritative analytical facts.
