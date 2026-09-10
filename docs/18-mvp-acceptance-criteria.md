# MVP Acceptance Criteria

## 1. Purpose

These criteria define the minimum conditions that must be satisfied before the MVP is considered functionally, financially, and technically acceptable.

## 2. Workspace

### AC-001 Create Workspace
Given an authenticated user, when a workspace is created, then the system creates an isolated organization with required configuration and assigns the creator an administrative role.

### AC-002 Tenant Isolation
A user must never retrieve, modify, export, or expose another organization's data through UI, API, background jobs, reports, or AI.

## 3. Import

### AC-003 Valid Import
Given a valid supported CSV/XLSX file, the user can upload, map, validate, preview, import, reconcile, and publish it.

### AC-004 Invalid Import
Financially invalid rows must be rejected or blocked according to validation rules. The system must clearly identify the cause.

### AC-005 Idempotency
Retrying the same logical import must not create duplicate authoritative financial facts.

### AC-006 Traceability
Every published financial fact must be traceable to its import/source row and mapping version where applicable.

### AC-007 Reconciliation
The user receives a reconciliation result before publish. Material unexplained differences block publish unless an authorized override is recorded.

## 4. Financial Model

### AC-008 Deterministic Calculations
Given the same inputs and configuration, the financial calculation engine produces the same outputs every time.

### AC-009 Sign Convention
Revenue, costs, assets, liabilities, and cash-flow signs follow one documented convention consistently across statements, dashboards, reports, and AI tools.

### AC-010 Statement Integrity
For test datasets, Revenue, COGS, Gross Profit, OPEX, EBITDA, EBIT, EBT, and Net Income reconcile according to the documented calculation rules.

## 5. Budget & Forecast

### AC-011 Budget Versioning
Users can create a budget version, submit it, approve it, and lock it. Locked versions cannot be silently edited.

### AC-012 Forecast Versioning
Users can create multiple forecast versions and compare them without overwriting prior versions.

### AC-013 Actual/Plan Separation
Actual, budget, forecast, and scenario values remain distinguishable in storage and presentation.

## 6. Analysis

### AC-014 Actual vs Budget
The platform calculates absolute and percentage variance where meaningful and identifies the comparison period/version.

### AC-015 Actual vs Forecast
The platform calculates forecast variance using the selected forecast version and correct period basis.

### AC-016 Drill-down
A material variance can be traced from metric → comparison → dimensions → underlying governed financial facts/source evidence where available.

## 7. Cash

### AC-017 Cash Forecast
The platform calculates projected closing cash using:

`Opening Cash + Expected Collections - Expected Payments + Financing - Capex = Closing Cash`

### AC-018 Cash Warning
A configured threshold or projected deficit generates a visible management warning.

## 8. Scenarios

### AC-019 Scenario Reproducibility
A saved scenario records its baseline and assumptions so the same scenario can be recalculated and explained later.

### AC-020 Scenario Isolation
Changing a scenario must not mutate actuals, approved budgets, or the baseline forecast.

## 9. Permissions & Governance

### AC-021 Scoped Authorization
A user can access only data and actions permitted by role and organizational scope.

### AC-022 Segregation of Duties
Where configured, a preparer cannot be the sole approver of the same planning artifact.

### AC-023 Audit Log
Material mutations record actor, timestamp, organization, action, target, and before/after values where applicable.

### AC-024 Locking
Locked periods and planning versions cannot be modified through ordinary edit operations.

## 10. AI Analyst

### AC-025 Grounded Answer
For a supported financial question, AI retrieves authorized model data and uses deterministic tools for financial calculations before generating an explanation.

### AC-026 No Fabrication
When required data is missing, inaccessible, or insufficient, AI states that limitation instead of inventing a value.

### AC-027 Semantic Separation
AI clearly distinguishes actual, budget, forecast, and scenario values in answers.

### AC-028 Permission Enforcement
AI cannot answer using data the requesting user is not authorized to access.

### AC-029 Read-only MVP
MVP AI cannot directly modify actuals, budgets, forecasts, or financial master data.

## 11. UX

### AC-030 Management Clarity
Users can identify current performance, plan status, material changes, cash outlook, and key management attention items without navigating through excessive screens.

### AC-031 Responsive Access
Core executive review, dashboards, alerts, and approvals remain usable on mobile; detailed planning remains optimized for desktop.

## 12. Reliability & Security

### AC-032 Transaction Safety
A failed publish/import operation does not leave partially published authoritative financial facts.

### AC-033 Secure File Handling
Unsupported or unsafe uploads are rejected according to the file security policy.

### AC-034 Observability
Errors in imports, calculations, API operations, and AI requests produce actionable logs without exposing secrets or sensitive data unnecessarily.

## 13. Definition of Done

An MVP feature is considered complete only when:

1. Functional behavior is implemented.
2. Authorization is enforced server-side.
3. Relevant calculations have automated tests.
4. Material mutations are auditable.
5. Error states are handled.
6. Tenant isolation is tested.
7. Documentation is updated where behavior changes.
8. No secrets are committed to the repository.

## 14. Release Gate

The MVP must not be released as production-ready until all mandatory acceptance criteria are tested and passed, including tenant isolation, deterministic financial calculations, import idempotency, version integrity, authorization, and AI grounding.
