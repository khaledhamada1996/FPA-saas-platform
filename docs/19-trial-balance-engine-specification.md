# Trial Balance Engine Specification

## 1. Purpose

Provide a governed trial balance derived from the approved opening-balance baseline and authoritative financial facts after the Import & Mapping publish gate.

## 2. Source of Truth

The engine reads:

- `opening_balances` for approved opening entries at or before the selected period start.
- `financial_facts` where `organization_id` matches the requested tenant, `fact_type = actual`, and `status = published`.
- The user must have access to the relevant organizational dimensions.

Rolled-back imports are excluded because their authoritative facts are removed by the controlled rollback operation.

## 3. Period Selection

The caller selects an existing `financial_periods` record belonging to the same organization. The engine does not infer the tenant from a client-supplied period alone.

## 4. Calculations

For every account with opening balance or activity in the selected period, return:

- opening debit/credit balance
- period debit
- period credit
- closing debit/credit balance

For balance-sheet accounts, opening balance is the net approved opening baseline plus the net published actual balance from dates before the selected period.

For income-statement accounts, opening balance is the fiscal-year-to-date net published actual balance from the fiscal-year start through the day before the selected period. This keeps the trial balance opening column consistent with the cumulative year-to-date position and preserves the debit/credit equality of the opening trial balance. At the fiscal-year start, income-statement opening balances are zero.

Opening debit and credit are mutually exclusive: a net positive opening balance is reported as debit, and a net negative opening balance is reported as credit. The engine must never expose both sides of the same account as its opening balance merely because historical debits and credits were aggregated separately.

Closing balance is opening balance + period debit - period credit.

Debit/credit values are represented in minor currency units in the database and formatted by the client.

## 5. Filters

All reporting dimension filters are applied consistently to financial facts and opening balances. A dimension-specific opening balance is included only when it matches the selected dimension filter. An opening balance with a null dimension is treated as unassigned and is not attributed to a specific dimension when that dimension is filtered.

## 6. Integrity

For a balanced journal import, period total debit must equal period total credit. The API returns the period difference explicitly so the UI can surface an imbalance rather than hiding it.

The opening balance is normalized to one side per account, and the closing balance is calculated from that normalized net balance. Explicit opening entries are not double-counted as journal activity.

## 7. Security

`public.get_trial_balance(uuid, uuid, ...)` is a `SECURITY DEFINER` function with an empty `search_path`. It is executable only by `authenticated` and requires the organization `view` permission. Because the function bypasses table RLS as a definer function, it explicitly enforces tenant ownership and the configured organizational data-scope predicates before aggregating facts and opening balances.

## 8. MVP Boundary

The MVP engine reports actuals. Budget, forecast, adjustments, consolidation, advanced dimensions, and comparative analytics are separate downstream capabilities and must not be silently mixed into the actual trial balance.
