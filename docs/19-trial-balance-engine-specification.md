# Trial Balance Engine Specification

## 1. Purpose

Provide a governed trial balance derived from authoritative financial facts after the Import & Mapping publish gate.

## 2. Source of Truth

The engine reads `financial_facts` where:

- `organization_id` matches the requested tenant.
- `fact_type = actual`.
- The user has access to the relevant organizational dimensions.

Rolled-back imports are excluded because their authoritative facts are removed by the controlled rollback operation.

## 3. Period Selection

The caller selects an existing `financial_periods` record belonging to the same organization. The engine does not infer the tenant from a client-supplied period alone.

## 4. Calculations

For every account with opening balance or activity in the selected period, return:

- opening debit/credit balance
- period debit
- period credit
- closing debit/credit balance

Opening balance is the net actual balance from periods before the selected period. Closing balance is opening balance + period debit - period credit.

Debit/credit values are represented in minor currency units in the database and formatted by the client.

## 5. Integrity

For a balanced journal import, period total debit must equal period total credit. The API returns the period difference explicitly so the UI can surface an imbalance rather than hiding it.

## 6. Security

`public.get_trial_balance(uuid, uuid)` is a `SECURITY DEFINER` function with an empty `search_path`. It is executable only by `authenticated` and requires the organization `view` permission. Because the function bypasses table RLS as a definer function, it explicitly enforces tenant ownership and the configured organizational data-scope predicates before aggregating facts.

## 7. MVP Boundary

The MVP engine reports actuals. Budget, forecast, adjustments, consolidation, advanced dimensions, and comparative analytics are separate downstream capabilities and must not be silently mixed into the actual trial balance.
