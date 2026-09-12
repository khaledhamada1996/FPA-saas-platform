# Canonical Production Baseline Checklist

The Production database is the current reference state. This checklist prevents inventing or silently rewriting historical migration history.

## Captured

- [x] 54 live migration ledger entries identified
- [x] 30 public relations identified (29 tables + 1 view)
- [x] Public table columns/defaults inventory captured
- [x] PK/FK/UNIQUE/CHECK inventory captured
- [x] RLS enabled state captured
- [x] RLS policy inventory captured
- [x] Index inventory captured
- [x] Trigger inventory captured
- [x] Security-sensitive function definitions captured
- [x] Explicit Data API grants inventory started

## Still required before declaring a clean baseline

- [ ] Exact extension inventory
- [ ] Exact enum/domain/custom type inventory
- [ ] Complete view definition export
- [ ] Complete function definition export for all application functions
- [ ] Complete explicit grant/revoke export including function EXECUTE privileges
- [ ] Required seed/configuration data inventory
- [ ] Dependency-ordered canonical SQL file
- [ ] Clean disposable/local PostgreSQL rebuild
- [ ] Production-vs-rebuilt schema contract comparison
- [ ] Tenant-isolation runtime test execution

## Rules

1. Do not fabricate missing historical migration SQL.
2. Do not mark old migration versions as applied merely to silence drift.
3. Do not modify Production while constructing the baseline.
4. A new canonical baseline represents the approved current Production state; it does not claim to reconstruct the original 54 migration bodies.
5. No Budget/Forecast engine implementation begins until the security and reproducibility gate is passed.