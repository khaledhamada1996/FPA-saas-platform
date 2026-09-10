# Initial Technical Decisions

## ADR-001: Modular Monolith First

**Decision:** Start with a modular monolith.

**Reason:** The MVP has strong domain coupling across financial model, planning, analytics, and authorization. A modular monolith provides clear boundaries without premature distributed-system complexity.

## ADR-002: PostgreSQL as System of Record

**Decision:** Use PostgreSQL for tenant, organizational, financial, planning, workflow, and audit data.

**Reason:** Relational integrity, transactions, indexing, dimensional queries, and mature ecosystem fit the domain.

## ADR-003: Deterministic Financial Calculations

**Decision:** Core financial calculations are implemented in application/domain logic, not delegated to an LLM.

**Reason:** Financial outputs require reproducibility, testability, precision, and auditability.

## ADR-004: Excel/CSV Before Deep Integrations

**Decision:** Make file-based import the first external data path.

**Reason:** It reduces integration dependencies and validates the core FP&A workflow before building many connectors.

## ADR-005: AI Behind a Provider Abstraction

**Decision:** AI access is mediated through an internal provider/tool interface.

**Reason:** Models, providers, pricing, latency, and enterprise requirements will evolve.

## ADR-006: Multi-Tenant from Day One

**Decision:** Tenant boundaries are part of the initial data and authorization architecture.

**Reason:** Retrofitting isolation after product growth creates unnecessary security and migration risk.

## ADR-007: Versioned Planning Artifacts

**Decision:** Budgets, forecasts, and scenarios are version-aware.

**Reason:** FP&A requires reproducible comparisons and controlled revisions.

## ADR-008: Production Hosting Is a Separate Decision

**Decision:** Do not hard-code a hosting provider before the architecture and commercial requirements are validated.

**Reason:** A free development tier may have commercial, runtime, database, or usage limitations unsuitable for a SaaS production environment.

## Decision Review Rule

Any architectural decision that materially affects security, financial correctness, tenant isolation, data migration, or recurring infrastructure cost should be documented before implementation.
