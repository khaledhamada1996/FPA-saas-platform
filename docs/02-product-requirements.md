# Product Requirements

## Functional Requirements

### Organization
- Create and configure a company workspace.
- Support fiscal year, currency, industry, organizational structure, and planning calendar.
- Support branches, departments, cost centers, products, projects, and other dimensions.

### Users
- Invite users to an organization.
- Assign roles and scoped permissions.
- Restrict access by company, branch, department, cost center, or other supported dimensions.

### Data
- Import Excel and CSV files.
- Validate uploaded data before import.
- Map source accounts/categories to the platform financial model.
- Preserve source information and import history.
- Support manual adjustments through controlled workflows.

### Planning
- Build annual, quarterly, and monthly budgets.
- Support top-down and bottom-up planning.
- Support driver-based planning.
- Create forecast versions and rolling forecasts.
- Create named scenarios such as Base, Best, and Worst.

### Analysis
- Actual vs Budget.
- Actual vs Forecast.
- Forecast vs Budget.
- Variance amount and percentage.
- Driver-based variance explanations.
- Profitability by supported dimensions.
- Cash-flow forecasting.
- KPI monitoring.

### Reporting
- Management reports.
- Budget and forecast reports.
- Variance reports.
- Cash forecast.
- KPI reports.
- Department/branch reports.
- Executive and board reporting.

### AI
- Answer financial questions using authorized company data.
- Explain performance changes.
- Summarize management reports.
- Support what-if questions.
- Suggest investigation areas and management actions.
- Never fabricate unavailable financial data.

### Governance
- Approval workflow for submissions and plans.
- Version control for budgets and forecasts.
- Audit trail for material changes.
- Lock approved periods/versions where required.

## Non-Functional Requirements

- Multi-tenant isolation.
- Strong authorization at API and database layers.
- Responsive web UI.
- Reliable calculation engine with deterministic financial calculations.
- Idempotent imports where applicable.
- Clear error messages and validation feedback.
- Observability for application, imports, calculations, and AI requests.
- Secure handling of uploaded files and secrets.
- Architecture capable of scaling from small businesses to enterprise organizations.

## Explicit Non-Goals

The initial product will not attempt to become:

- A general ledger.
- An ERP.
- A payroll system.
- A full CRM.
- A banking platform.
- A replacement for source accounting systems.

These systems may become integration sources later.
