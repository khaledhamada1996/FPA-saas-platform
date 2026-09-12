# Financial Statements Engine

## Purpose

The Financial Statements Engine converts published actual financial facts into deterministic management statements.

## Current MVP outputs

- Income Statement
- Balance Sheet

## Income Statement

Revenue → COGS → Gross Profit → Operating Expenses → EBITDA → Finance Cost → EBT → Tax → Net Income.

## Balance Sheet

Assets, liabilities, and equity are presented from account classifications and published actual facts for the selected financial period.

## Calculation rules

- Only `financial_facts` with `fact_type = actual` are authoritative for this engine.
- Facts must belong to the selected organization and financial period.
- Calculations are deterministic SQL/domain calculations.
- AI is not used as the authoritative calculation engine.
- Account classifications come from governed account metadata (`account_type`, `statement_type`, and `statement_section`).
- Missing classification is not silently guessed.

## Security

The read RPC requires authentication and the organization's `view` permission. It is implemented as `SECURITY DEFINER` with an empty `search_path`; anonymous execution is denied.

## Next extension

Add comparative periods, cash-flow statement, statement drill-down, and explicit classification validation before advanced financial analysis.
