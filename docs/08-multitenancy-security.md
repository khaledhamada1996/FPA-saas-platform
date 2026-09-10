# Multitenancy & Security

## Tenant Model

The platform is a multi-tenant SaaS. An organization/tenant owns its users, configuration, financial data, planning models, reports, and AI-accessible context.

No request, query, background job, export, or AI retrieval operation may cross tenant boundaries.

## Authorization

Authorization is evaluated at more than the UI layer. APIs and data access must enforce organization membership, role permissions, and scope restrictions.

## Required Controls

- Tenant isolation at database and application layers.
- RBAC with scoped authorization.
- Secure authentication and session management.
- MFA support in the security roadmap.
- Encryption in transit and at rest where supported by infrastructure.
- Secret management outside source control.
- Audit logs for material actions.
- Rate limiting for sensitive endpoints.
- Secure file upload validation and scanning strategy.
- Input validation and output encoding.
- Protection against common web vulnerabilities.
- Backups and tested restoration procedures.
- Monitoring and incident logging.

## Financial Data Governance

Actuals, budgets, forecasts, assumptions, and approved versions must be distinguishable. Approved artifacts should not be silently overwritten.

## AI Security

AI retrieval must apply the same authorization boundaries as the application. Prompts and retrieved financial context must not expose unauthorized tenant data. Sensitive credentials and secrets must never be included in model prompts.

## Audit Requirements

Audit events should capture actor, timestamp, organization, action, target entity, request context where appropriate, and before/after values for material mutations.

## Enterprise Readiness

The architecture should leave room for SSO, stronger identity controls, data retention policies, regional hosting requirements, and enterprise audit/export capabilities without making these requirements mandatory for the MVP.
