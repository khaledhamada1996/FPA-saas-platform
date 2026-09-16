# Financial Statements Engine

## Purpose

The Financial Statements Engine converts published actual financial facts into deterministic management statements.

## Current MVP outputs

- Income Statement
- Balance Sheet
- Cash Flow Statement
- Statement of Changes in Equity
- Other Comprehensive Income

## Income Statement

Revenue → COGS → Gross Profit → Operating Expenses → EBITDA → Depreciation & Amortization → EBIT → Finance Cost → EBT → Tax → Net Income.

### Depreciation & Amortization classification

Depreciation and amortization expense accounts must use the governed `statement_subclassification = 'depreciation_amortization'` classification.

They are excluded from `operating_expenses` for EBITDA calculation and then deducted separately to derive EBIT. This prevents D&A from being deducted twice and also supplies the non-cash D&A add-back required by the indirect cash-flow statement.

The classification is explicit and governed; the engine does not infer D&A from arbitrary account names at report time.

## Balance Sheet

Assets, liabilities, and equity are presented from account classifications and published actual facts for the selected financial period.

## Cash Flow Statement

The indirect method uses authoritative net income plus the governed D&A classification and working-capital movements. The direct method remains journal-based where configured. Cash-flow reconciliation must equal zero for a reconciled report.

## Statement of Changes in Equity

Equity movements are derived from governed equity roll-forward roles, with current-year profit sourced from the income statement and OCI tracked separately.

## Other Comprehensive Income

OCI accounts use the dedicated `other_comprehensive_income` classification and are reported separately from profit or loss.

## Calculation rules

- Only `financial_facts` with `fact_type = actual` are authoritative for this engine.
- Facts must belong to the selected organization and financial period/range.
- Calculations are deterministic SQL/domain calculations.
- AI is not used as the authoritative calculation engine.
- Account classifications come from governed account metadata (`account_type`, `statement_type`, and `statement_section`).
- Missing classification is not silently guessed.
- EBITDA must reconcile as `EBITDA = EBIT + Depreciation & Amortization`.
- Balance-sheet validation must reconcile to zero.
- Cash-flow validation must reconcile to zero.
- Equity roll-forward validation must reconcile to zero.

## Security

The read RPC requires authentication and the organization's `view` permission. It is implemented as `SECURITY DEFINER` with an empty `search_path`; anonymous execution is denied.

## Regression validation

The database includes `public.validate_financial_statement_math(...)` for deterministic regression checks of D&A classification, EBITDA/EBIT reconciliation, and balance-sheet integrity.

## Next extension

Add comparative periods, statement drill-down, richer OCI presentation, and explicit classification validation before advanced financial analysis.
