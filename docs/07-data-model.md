# Logical Data Model

## Tenancy

- organizations
- organization_users
- roles
- permissions
- user_roles
- `organizations.activity_key` is mandatory and references `financial_activities`.

## Organization Structure

- legal_entities
- branches
- departments
- cost_centers
- regions
- products
- projects
- custom_dimensions

## Company Activity & Reporting

- `financial_activities` is the controlled activity catalog used during company setup.
- The company activity is selected from a mandatory dropdown; free-text industry is no longer the source of reporting-template selection.
- Each activity has a reporting profile describing the appropriate presentation emphasis, terminology, and activity-specific sections.
- `financial_statement_templates` stores the reporting template associated with each activity.
- `organization_reporting_preferences` stores the resolved template for the tenant so reporting is deterministic and auditable.
- Changing the company activity updates the organization reporting preference atomically.
- The reporting model remains IFRS-oriented; activity profiles determine presentation emphasis and account aggregation rather than replacing applicable IFRS recognition and measurement requirements.

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
- Account hierarchy is represented by `accounts.parent_account_id`.
- Statement aggregation must roll child accounts into their reporting parents before calculating statement totals.

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
8. Company activity must be captured before financial reporting is initialized.
9. Activity selection must resolve the reporting template server-side; the UI must not be trusted to choose the accounting/reporting model.
10. Activity-specific presentation must remain compatible with the applicable IFRS requirements and must not be treated as a substitute for recognition, measurement, or disclosure rules.
