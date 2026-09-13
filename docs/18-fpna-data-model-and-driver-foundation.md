# FP&A Data Model and Driver Foundation

## Purpose

The platform is designed around governed FP&A data rather than isolated imports. Every dataset must have a defined role in the planning and reporting lifecycle.

## Core data domains

### 1. Organization and master data

- Organization / group
- Legal entities
- Branches
- Departments
- Cost centers
- Regions
- Products
- Projects

### 2. Financial foundation

- Chart of accounts
- Account hierarchy and statement classification
- Financial periods
- Reporting currency and reporting standard

### 3. Actuals

Primary source:

- Journal transactions

Alternative source when journal detail is unavailable:

- Trial balance

Actuals must remain traceable to their source import and source row.

### 4. Planning

- Budget versions
- Forecast versions
- Scenario versions
- Cash planning
- Drivers and assumptions

Budget, forecast and scenario data must never be stored as actuals.

## Driver-based planning

Modern FP&A needs operational drivers in addition to accounting balances. Drivers are first-class entities and can be reused by budgets, forecasts and scenarios.

Examples:

- Units sold
- Average selling price
- Customers
- Headcount
- Average salary
- Number of branches
- Utilization
- Occupancy
- Growth rate
- Inflation rate
- Collection days
- Payment days

The system stores:

`Driver Definition → Period/Version Value → Optional Dimensions → Source Traceability`

Driver values can originate from manual entry, import, integration or calculation.

## Minimum data needed for core outputs

### Historical reporting

`Organization + COA + Periods + Actuals/TB + Dimensions`

→ Trial Balance → Financial Statements → Financial Analysis

### Budget / Forecast

`Historical Foundation + Planning Version + Plan Values + Drivers/Assumptions`

→ Budget / Forecast → Variance → Executive Reporting

### Scenario analysis

`Base Plan + Scenario + Driver/Assumption Changes`

→ Scenario Results

### Cash forecast

`Opening Cash + Operating Inflows + Operating Outflows + Financing + Collection/Payment Assumptions`

→ Closing Cash Forecast

## Import principle

The Import area must identify the dataset before accepting a file. The supported contracts are:

1. Actual journal transactions — active MVP path
2. Trial balance — planned
3. Chart of accounts — planned
4. Master data / dimensions — planned
5. Planning data — planned
6. Driver / assumption data — planned

These contracts must be implemented end-to-end before their UI is marked as active.

## Canonical lifecycle

```text
Organization / Master Data
        ↓
Chart of Accounts + Financial Periods
        ↓
Actuals or Trial Balance
        ↓
Validation + Mapping + Reconciliation
        ↓
Published Actuals
        ↓
Financial Statements + Analysis
        ↓
Budget / Forecast
        ↑
Drivers + Assumptions
        ↓
Scenarios
        ↓
Variance + Cash Forecast
        ↓
Executive Dashboard
        ↓
AI Financial Analyst
```

## Current implementation foundation

The database already contains the core master-data, financial-fact, planning-version, budget, forecast, scenario and import structures. The driver foundation is now represented by:

- `planning_drivers` — reusable driver definitions
- `planning_driver_values` — period/version values with dimensions and source traceability

This foundation is intentionally added before activating a new planning import type. The next implementation stages should build the end-to-end driver workflow and then activate planning imports against the governed model rather than creating a parallel data path.
