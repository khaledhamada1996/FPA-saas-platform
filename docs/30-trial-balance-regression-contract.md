# Trial Balance Regression Contract

## Opening balance

The trial balance opening columns represent the net balance immediately before the selected financial period, not the gross sum of all prior debit and credit movements.

For each account:

- `opening_balance = prior_debit - prior_credit`
- `opening_debit = max(opening_balance, 0)`
- `opening_credit = max(-opening_balance, 0)`
- `closing_balance = opening_balance + period_debit - period_credit`
- `closing_debit = max(closing_balance, 0)`
- `closing_credit = max(-closing_balance, 0)`

Balance-sheet accounts include approved opening balances plus published actual activity before the selected period. Income-statement accounts use year-to-date activity before the selected period.

The UI must consume the canonical `get_trial_balance` RPC and must not reconstruct opening balances from the full fact set on the client.
