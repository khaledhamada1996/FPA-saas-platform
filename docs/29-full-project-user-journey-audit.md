# Full Project User-Journey Audit

## Audit baseline

Reviewed against the current `main` branch, the production Supabase schema, the documented MVP acceptance criteria, and the application routes available in the workspace.

## User journey

1. Landing page → sign in / sign up.
2. Authentication callback preserves the intended destination.
3. `/start` discovers the companies the authenticated user can access.
4. A single company enters the workspace directly; multiple companies are shown as a hierarchy.
5. Company creation supports independent companies and authorized subsidiaries.
6. Workspace authorization is now checked per screen before rendering the route.
7. Unauthorized users are sent to an explicit access-denied page.
8. Team management uses database roles, hierarchy levels, explicit user permissions, and manageable descendants.
9. New invited users remain permissionless until an authorized manager grants access.
10. Financial workflows remain behind their existing server-side RPC/RLS boundaries.

## Current modules exposed by the application

- Workspace overview
- Executive dashboard
- Actuals
- Data/imports
- Account master
- Import history
- Trial balance
- Financial statements
- Financial analysis
- Budget
- Forecast
- Variance
- Cash forecast
- Scenarios
- Dimensions
- Reports
- AI financial analyst
- Audit
- Company profile
- Team and permissions

## Authorization model

Roles are hierarchy templates. Effective access is explicit per user. A manager may manage only users below or within their permitted hierarchy, may assign only roles at or below their own level, and may grant only permissions the manager already possesses.

Screen permissions are separate catalog entries from action permissions. This permits combinations such as:

- can open Budget but cannot edit it
- can open Import but cannot publish actuals
- can open Reports but cannot export
- can open AI Analyst only when the AI permission is granted

## Security checks completed

- Direct client INSERT to `financial_facts` is denied.
- Direct client INSERT to `audit_events` is denied.
- `financial_facts_scoped_select` exists.
- `publish_actuals_from_import` remains executable for authenticated clients and not for anonymous clients.
- Screen access RPC exists and is authenticated-only.
- New company administrator initialization now includes screen permissions.
- Security-definer RPCs are restricted from anonymous execution except the login rate-limit functions that must operate before authentication.

## Known release blockers / remaining work

1. End-to-end browser testing must be run against the deployed Cloudflare site for every major user journey.
2. The application build must pass in CI/Cloudflare after the latest authorization changes. A GitHub Actions build workflow has been added; the connector currently reports no workflow run yet.
3. The Supabase Auth leaked-password protection warning must be enabled in the Auth configuration before production release.
4. Nine tables intentionally have RLS enabled without direct policies because their access is expected through governed RPCs; this should be reviewed individually before release.
5. The workspace home navigation still contains some links that should be filtered by the same permission catalog used by route authorization. Direct URL access is protected now; navigation hiding should be completed as a UX pass.
6. Every material mutation should have a corresponding regression test, especially hierarchy changes, permission overrides, company hierarchy mutations, and planning workflows.
7. The remaining roadmap modules should not be presented as production-ready until their acceptance criteria and authorization tests pass.

## Release rule

The product is not considered production-ready merely because the UI loads. Release requires the functional, authorization, tenant-isolation, deterministic-calculation, audit, import, planning, AI-grounding, and reliability acceptance criteria to be tested and passed.
