# AI Financial Analyst

## Purpose
The AI Financial Analyst is an explanatory decision-support layer over the deterministic FP&A engines. It is not the authoritative calculation engine and cannot write or alter financial facts.

## MVP architecture
1. The authenticated user selects an organization and financial period.
2. The server validates tenant membership and `view` permission.
3. `get_ai_financial_context(organization_id, period_id)` returns a bounded context from the Financial Statements, Financial Analysis, and Executive Dashboard engines.
4. A future server-side model provider integration may consume this context to generate explanations, observations, and recommendations.

## AI guardrails
- Use only supplied deterministic context.
- Never invent missing financial values, periods, transactions, or classifications.
- Clearly distinguish facts, interpretation, and recommendations.
- State when available data is insufficient.
- Do not modify financial facts, mappings, periods, budgets, forecasts, or approvals.
- Never bypass organization or data-scope authorization.
- The AI output is advisory and must not be treated as the accounting system of record.

## Security
`get_ai_financial_context` is `SECURITY DEFINER`, uses an empty `search_path`, requires authentication, checks organization `view` permission, verifies that the selected period belongs to the organization, and is executable only by `authenticated`.

## Current status
The secured context layer is implemented. No external AI provider/API key is assumed or embedded. Provider integration should be added server-side only after its credential/configuration is available.

## Testing constraint
The project currently has no financial periods / production financial facts suitable for a real calculation test. No fabricated financial data is introduced merely to demonstrate AI output.
