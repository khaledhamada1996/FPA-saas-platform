# AI Financial Analyst

## Purpose
The AI Financial Analyst is an explanatory decision-support layer over the deterministic FP&A engines. It is not the authoritative calculation engine and cannot write or alter financial facts.

## MVP architecture
1. The authenticated user selects an organization and financial period.
2. The browser sends the current Supabase access token to the server-side AI route; no Gemini credential is exposed to the browser.
3. The server calls `get_ai_financial_context(organization_id, period_id)`, which validates tenant membership and `view` permission and returns bounded context from the Financial Statements, Financial Analysis, and Executive Dashboard engines.
4. The server sends only that trusted context plus the user's question to Gemini.
5. The server returns the generated explanation to the UI; no AI response is persisted as financial truth.

## Provider
- Model: `gemini-2.5-flash`.
- Credentials: `GEMINI_API_KEY_1`, with optional `_2` and `_3` server-side failover keys.
- Keys must be configured as Cloudflare runtime secrets, never as `NEXT_PUBLIC_*` variables and never in source control.
- Key failover is resilience, not quota multiplication. Gemini quota is governed by the underlying project/account configuration.
- Provider calls are made server-side through the Gemini REST API.

## AI guardrails
- Use only supplied deterministic context.
- Never invent missing financial values, periods, transactions, or classifications.
- Clearly distinguish facts, interpretation, and recommendations.
- State when available data is insufficient.
- Do not modify financial facts, mappings, periods, budgets, forecasts, or approvals.
- Never bypass organization or data-scope authorization.
- The AI output is advisory and must not be treated as the accounting system of record.
- User questions are length-limited and the generation temperature is intentionally low for financial explanations.

## Security
`get_ai_financial_context` is `SECURITY DEFINER`, uses an empty `search_path`, requires authentication, checks organization `view` permission, verifies that the selected period belongs to the organization, and is executable only by `authenticated`.

The `/api/ai-analyst` route rejects unauthenticated requests, validates organization/period/question inputs, obtains the trusted context through the secured RPC, and reads Gemini keys only from server runtime secrets. The browser never receives the Gemini key.

## UI
`/workspace/ai-analyst` provides:
- financial-period selector scoped to the active organization;
- Arabic question input;
- server-side analysis action;
- explanatory answer panel;
- explicit source/advisory notice.

## Current status
The secure context layer, Gemini server route, and Arabic analyst UI are implemented in GitHub. End-to-end provider execution still depends on the configured Cloudflare runtime secret being present in the deployed environment and on a real financial period containing published facts.

## Testing constraint
The project currently has no financial periods / production financial facts suitable for a real calculation test. No fabricated financial data is introduced merely to demonstrate AI output.
