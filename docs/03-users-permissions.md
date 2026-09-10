# Users & Permissions

## Core Roles

| Role | Primary responsibility |
|---|---|
| Company Admin | Workspace, users, configuration, access |
| CEO | Executive visibility and decisions |
| CFO | Financial planning, review, approval, reporting |
| Finance Manager | Planning, forecasting, analysis, reporting |
| FP&A Analyst | Models, forecasts, scenarios, analysis |
| Accountant | Actuals, imports, reconciliations, adjustments |
| Department Manager | Department submissions and performance |
| Sales Manager | Sales assumptions and operational drivers |
| HR Manager | Headcount and personnel assumptions |
| Procurement Manager | Procurement and cost assumptions |
| Operations Manager | Operational drivers and assumptions |

Roles are templates. Authorization must be evaluated using both role permissions and organizational scope.

## Permission Model

Permissions are action-based, including:

- view
- create
- edit
- delete
- import
- export
- submit
- approve
- reject
- lock
- manage_users
- manage_settings
- manage_budget
- manage_forecast
- manage_scenarios
- access_ai

## Scope

A permission may be scoped to:

- organization
- legal entity
- branch
- department
- cost center
- region
- product
- project

Example: a regional sales manager may edit sales assumptions for one region while being unable to edit finance-owned forecast figures.

## Approval Principle

A user who prepares a budget or forecast should not automatically be the sole approver of that same artifact when segregation of duties is required.

## Auditability

Material actions must record actor, timestamp, entity, previous value where applicable, new value where applicable, action, and relevant request/version identifiers.
