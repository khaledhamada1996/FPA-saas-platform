# MVP Implementation Plan

## 1. Objective

Implement the smallest production-quality FP&A core that proves the complete value chain:

`Workspace → Import → Validate/Map → Actuals → Budget → Forecast → Variance → Cash → Scenario → AI Explanation`

## 2. Architecture Rule

Implement as a modular monolith with strict domain boundaries. Do not introduce microservices during MVP unless a measured technical requirement makes them necessary.

## 3. Build Order

### Step 1 — Application Foundation

- Next.js + TypeScript project structure.
- Environment configuration.
- Database connection and migrations.
- Authentication.
- Organization creation and membership.
- Base layout/navigation.
- Error handling and logging foundations.

### Step 2 — Authorization & Tenant Isolation

- Organization-aware data access.
- Roles and permissions.
- Scoped authorization foundations.
- Server-side enforcement.
- Audit event infrastructure.

This step must be completed before sensitive financial modules are exposed.

### Step 3 — Organization Model

- Legal entities.
- Branches.
- Departments.
- Cost centers.
- Regions/products/projects where enabled.
- Fiscal calendar.
- Base currency.

### Step 4 — Financial Master Model

- Accounts.
- Account categories.
- Financial periods.
- Dimension references.
- Sign conventions.
- Monetary precision.

### Step 5 — Import & Mapping

- Secure file upload.
- CSV/XLSX parsing.
- Import records/statuses.
- Column mapping.
- Account/dimension mapping.
- Validation.
- Preview.
- Reconciliation.
- Idempotent publish.
- Source traceability.

### Step 6 — Actual Financial Model

- Normalize published actual facts.
- P&L calculations.
- Basic balance-sheet structure.
- Basic cash-flow structure.
- Period close/lock foundation.
- Drill-down/source references.

### Step 7 — Budget

- Budget creation.
- Monthly planning.
- Basic assumptions.
- Budget versions.
- Submit/review/approve/lock.
- Actual vs Budget.

### Step 8 — Forecast

- Forecast creation.
- Forecast versions.
- Historical baseline.
- Basic growth assumptions.
- Management overrides.
- Actual vs Forecast.

### Step 9 — Cash & Scenarios

- Basic cash forecast.
- Threshold warnings.
- Scenario cloning.
- Assumption changes.
- Deterministic recalculation.
- Scenario comparison.

### Step 10 — Analytics & Dashboard

- Executive overview.
- Revenue.
- Gross Profit/Margin.
- EBITDA.
- Net Income.
- Cash.
- Budget achievement.
- Forecast outlook.
- Core KPIs.
- Material variances.

### Step 11 — AI Analyst

Implement only after governed financial queries are available.

Initial capabilities:

- Explain metric movement.
- Compare actual vs budget.
- Compare actual vs forecast.
- Explain material variance.
- Summarize management performance.

AI must use authorized deterministic tools and remain read-only in MVP.

### Step 12 — Hardening & Release Gate

- Automated tests.
- Tenant-isolation tests.
- Authorization tests.
- Calculation tests.
- Import idempotency tests.
- Version/locking tests.
- AI grounding tests.
- File-security tests.
- Error handling.
- Performance baseline.
- Backup/restore verification.
- Production configuration review.

## 4. Dependency Rules

- No analytics before the governed financial model exists.
- No AI financial answers before deterministic query/calculation tools exist.
- No production financial data before import validation and tenant isolation are verified.
- No editable approved artifact without versioning/audit behavior.

## 5. MVP Exclusions

Do not implement during the first MVP unless validation requires it:

- Deep ERP integrations.
- Full consolidation.
- Enterprise SSO.
- Advanced predictive forecasting.
- Complex workflow designer.
- Extensive custom dimensions.
- Full board-pack automation.
- AI write actions.
- Advanced multi-currency translation.

## 6. Delivery Strategy

Each step should be delivered as a coherent vertical slice where possible, with tests and documentation updated alongside implementation.

The repository should remain deployable after each major milestone. Large unreviewed feature branches should be avoided.

## 7. Technical Quality Gate

Before moving from one financial domain to the next:

- schema migration is reviewed
- authorization is tested
- domain calculations are tested
- audit behavior is verified
- tenant isolation is verified
- failure/rollback behavior is verified

## 8. Commercial Validation Gate

Before significant investment in Phase 2 integrations and enterprise capabilities, validate:

- target ICP
- core use cases
- willingness to pay
- expected users/organizations
- data source requirements
- integration demand
- AI value

## 9. Implementation Principle

Build the financial core correctly before optimizing for feature count. A smaller trustworthy FP&A engine is preferable to a large dashboard product with weak financial governance.
