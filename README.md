# FP&A SaaS Platform

A multi-tenant Financial Planning & Analysis platform designed to help companies plan, forecast, analyze performance, model scenarios, and turn financial data into management decisions.

## Product Positioning

This is **not an accounting system or ERP**. It operates as an FP&A and financial decision layer above existing accounting, ERP, CRM, payroll, operational, and spreadsheet systems.

## Core Cycle

`Collect → Validate → Model → Budget → Forecast → Compare → Explain → Scenario → Decide → Act`

## Implementation Status

**MVP implementation in progress.**

Completed foundation slices include:

- Arabic RTL application shell.
- Organization domain model.
- PostgreSQL/Supabase migration foundation.
- Authentication entry points.
- Session refresh middleware.
- Workspace creation and membership onboarding.
- Initial tenant-aware Row Level Security policies.
- Server-side dashboard access guard.

## Environment

Set the following variables in the deployment environment or local `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do not commit real credentials or secrets.

## Documentation

### Product & Architecture

- [01 Product Vision](docs/01-product-vision.md)
- [02 Product Requirements](docs/02-product-requirements.md)
- [03 Users & Permissions](docs/03-users-permissions.md)
- [04 Product Modules](docs/04-product-modules.md)
- [05 User Flows](docs/05-user-flows.md)
- [06 FP&A Functional Specification](docs/06-fpa-functional-specification.md)
- [07 Data Model](docs/07-data-model.md)
- [08 Multitenancy & Security](docs/08-multitenancy-security.md)
- [09 System Architecture](docs/09-system-architecture.md)
- [10 AI Architecture](docs/10-ai-architecture.md)
- [11 MVP Scope](docs/11-mvp-scope.md)
- [12 Roadmap](docs/12-roadmap.md)
- [13 SaaS Business Model](docs/13-saas-business-model.md)
- [14 UI/UX Specification](docs/14-ui-ux-specification.md)
- [15 Technical Decisions](docs/15-technical-decisions.md)
- [16 Domain Financial Model](docs/16-domain-financial-model.md)
- [17 Import & Mapping Specification](docs/17-import-mapping-specification.md)
- [18 MVP Acceptance Criteria](docs/18-mvp-acceptance-criteria.md)
- [19 MVP Implementation Plan](docs/19-mvp-implementation-plan.md)

## Development Rule

Documentation, domain rules, acceptance criteria, and architecture are approved before production implementation. Each vertical slice must preserve deployability, tenant isolation, authorization, auditability, and deterministic financial correctness.
