# FP&A Platform Remediation Plan

## Purpose
Stabilize the financial core and tenant governance before building Budget, Forecast, Variance, Cash Forecast, Scenarios, or AI Analyst.

## P0 — Financial integrity and tenant isolation
1. Select one canonical financial fact model and remove the parallel actuals architecture.
2. Preserve journal identity, source import, source row, debit/credit and drill-down traceability.
3. Make imports idempotent so re-uploading the same logical data cannot duplicate facts.
4. Enforce open-period checks before publish; closed/locked periods are immutable.
5. Enforce workspace scoping everywhere; never select an organization with `limit(1)`.
6. Verify and harden RLS for every tenant-owned table and test cross-tenant denial.
7. Enforce workspace creation through the secured RPC rather than unrestricted direct inserts.
8. Implement real role/permission checks server-side and separate preparation from approval.
9. Write immutable audit events for security, imports, mappings, approvals, locks and material changes.

## P1 — Financial model
10. Complete account classification, statement mapping, parent hierarchy and contra-account handling.
11. Define deterministic sign conventions and natural-balance derivation.
12. Build trial balance and statement engines from governed facts.
13. Add import preview, reconciliation, publish confirmation and rollback/error visibility.
14. Standardize Excel as the primary import/template experience and either implement CSV fully or remove CSV claims until implemented.

## P2 — FP&A modules
15. Budget versions with monthly detail and approval/lock workflow.
16. Forecast versions with historical baseline, assumptions and management overrides.
17. Actual vs Budget and Actual vs Forecast variance engine with dimensional drill-down.
18. Cash forecast engine with deterministic opening/closing cash reconciliation.
19. Scenario engine with versioned assumptions and deterministic comparison.

## P3 — Product layer
20. Connect the truthful financial engine to the executive dashboard.
21. Add KPI definitions and material-variance alerts from governed data only.
22. Add read-only AI Analyst only after deterministic financial query tools are available.
23. Add automated tests for calculations, imports, idempotency, authorization, tenant isolation, locking and AI grounding.

## Release gate
No production financial data is accepted until P0 is complete and tested. No Budget/Forecast/AI feature is authoritative until it reads from the canonical financial model.
