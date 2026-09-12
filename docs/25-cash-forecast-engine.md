# Cash Forecast Engine

The MVP cash forecast engine provides a controlled planning layer for cash movements by financial period.

## Categories
- opening_cash
- cash_inflow
- cash_outflow
- financing
- closing_cash

## Security
- Organization-scoped RLS.
- View requires organization `view` permission.
- Write operations require `manage_budget`.
- Forecast lines can only be changed while the linked planning version is `draft`.
- RPCs use `SECURITY DEFINER` with an empty `search_path`.
- Anonymous execution is revoked.

## Data policy
The engine does not create synthetic production data. It operates on user-entered planning lines and existing financial periods.

## Next evolution
Future iterations can derive opening and closing cash automatically from approved actuals, integrate working-capital drivers, and add cash alerts and scenario comparisons.