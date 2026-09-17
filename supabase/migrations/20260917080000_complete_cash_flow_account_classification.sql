-- Deterministic cash-flow classification for the current chart of accounts.
-- Cash accounts remain identified by cash_flow_role='cash'.
-- Non-cash counterpart accounts receive an explicit direct-method category.
DO $$
BEGIN
  UPDATE public.accounts a
  SET cash_flow_direct_category = CASE
    WHEN a.cash_flow_role = 'cash' THEN NULL
    WHEN a.statement_subclassification IN ('revenue','other_income') THEN 'operating_inflow'
    WHEN a.statement_subclassification IN ('cogs','operating_expense','depreciation_amortization','other_expense','finance_cost','tax') THEN 'operating_outflow'
    WHEN a.statement_subclassification = 'equity' THEN
      CASE WHEN a.equity_rollforward_role = 'owner_distribution' THEN 'financing_outflow' ELSE 'financing_inflow' END
    WHEN a.statement_subclassification = 'liability' THEN
      CASE WHEN a.code >= '2200' THEN 'financing_inflow' ELSE 'operating_outflow' END
    WHEN a.statement_subclassification = 'asset' THEN
      CASE
        WHEN a.code LIKE '122%' THEN NULL
        WHEN a.code >= '1210' AND a.code < '1330' THEN 'investing_outflow'
        WHEN a.code >= '1110' AND a.code < '1210' THEN 'operating_outflow'
        WHEN a.code >= '1000' AND a.code < '1110' THEN 'operating_outflow'
        ELSE NULL
      END
    ELSE NULL
  END
  WHERE a.cash_flow_role IS DISTINCT FROM 'cash';
END $$;
