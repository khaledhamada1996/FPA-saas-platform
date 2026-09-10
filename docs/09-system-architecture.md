# System Architecture

## Architectural Style

Start as a modular monolith with clear domain boundaries. This reduces MVP operational complexity while keeping modules separable if scale later requires service extraction.

## Proposed Stack

- Frontend: Next.js + TypeScript.
- UI: Tailwind CSS with a reusable component system.
- Backend/application layer: Next.js server capabilities and domain services, with clear separation between UI and business logic.
- Database: PostgreSQL.
- Authentication: managed authentication provider compatible with the chosen database/security model.
- Object storage: secure storage for imported files and generated artifacts.
- AI: provider abstraction so models can change without rewriting the domain layer.

## Logical Layers

1. Presentation layer.
2. Authentication and authorization layer.
3. Application/use-case layer.
4. Domain/FP&A engine.
5. Data access layer.
6. PostgreSQL and object storage.
7. External integrations.
8. AI orchestration layer.

## Domain Modules

Auth, Organizations, RBAC, Dimensions, Imports, Mapping, Financial Model, Budget, Forecast, Scenarios, Cash, KPIs, Analytics, Reporting, Alerts, Actions, AI, Audit, Notifications, Billing.

## Data Flow

`Source Systems → Import/Collection → Validation → Mapping → Financial Facts → Model → Budget/Forecast → Analytics → Reports/AI → Decisions`

## Calculation Boundary

Core financial calculations belong to deterministic domain services. The AI layer can call approved calculation/query capabilities but should not independently invent numbers.

## Integration Strategy

Phase 1: Excel/CSV.

Later: accounting/ERP APIs, CRM, payroll, e-commerce, banking/treasury, and other operational systems through an integration abstraction.

## Scalability Strategy

Use organization-aware database access, indexed financial fact tables, pagination, asynchronous imports, background calculation jobs where necessary, caching for safe read-heavy workloads, and observability before introducing microservices.
