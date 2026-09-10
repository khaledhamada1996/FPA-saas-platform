# Logical Data Model

## Tenancy

- organizations
- organization_users
- roles
- permissions
- user_roles

## Organization Structure

- legal_entities
- branches
- departments
- cost_centers
- regions
- products
- projects
- custom_dimensions

## Source Data

- data_sources
- imports
- import_rows
- mapping_rules
- mapping_versions

## Financial Model

- accounts
- account_categories
- actuals
- adjustments
- financial_periods

## Planning

- budgets
- budget_versions
- budget_lines
- forecasts
- forecast_versions
- forecast_lines
- scenarios
- scenario_assumptions

## Operations & KPIs

- drivers
- driver_values
- kpis
- kpi_definitions
- kpi_values
- cash_forecasts

## Workflow & Governance

- submissions
- approvals
- locks
- audit_logs
- notifications

## Reporting & Actions

- reports
- report_versions
- alerts
- actions

## Design Principles

1. Every tenant-owned business object must carry an organization/tenant boundary or be safely reachable through one.
2. Financial facts should be periodized and dimension-aware.
3. Versions must be first-class objects where users need reproducibility.
4. Raw imported data and normalized financial facts should remain conceptually separate.
5. Audit records should be append-oriented and resistant to ordinary user editing.
6. Monetary values require explicit currency handling and precision rules.
7. Dates and fiscal periods must be modeled explicitly rather than inferred from display labels.
