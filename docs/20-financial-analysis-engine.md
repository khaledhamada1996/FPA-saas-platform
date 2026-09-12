# Financial Analysis Engine

## Purpose
Provide deterministic FP&A indicators from published actual financial facts. AI is not authoritative for calculations.

## MVP metrics
- Revenue growth versus the immediately preceding financial period by period_end
- Gross margin
- EBITDA margin
- Net margin
- Operating expense ratio
- Current-period revenue, gross profit, EBITDA and net income
- Prior-period comparison when a prior period exists
- Revenue trend: up, down, flat, or no_prior_period

## Calculation basis
Revenue = income/revenue credits minus debits.
COGS and operating expenses = debits minus credits.
Gross profit = revenue - COGS.
EBITDA = gross profit - operating expenses.
Net income = EBITDA - finance cost - tax.
Margins use revenue as denominator. Revenue growth is `(current - prior) / abs(prior) * 100`; growth is omitted when no prior period exists or prior revenue is zero.

## Security
`get_financial_analysis(uuid,uuid)` is SECURITY DEFINER with an empty search_path, requires an authenticated user and `view` permission for the organization, applies the same organizational data-scope checks used by the Trial Balance engine, and is executable by authenticated only.

## Known MVP limitation
Account classification currently relies on governed `account_type` values already present in the account model. The classification taxonomy should be tightened and validated before advanced analysis, forecasting, or AI interpretation is introduced.

## Next extension
Build Executive Dashboard from the same deterministic metrics, then add drill-down and variance analysis before the AI Financial Analyst layer.
