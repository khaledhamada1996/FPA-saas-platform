-- Fix forecast RPCs: cash_flow_direct_category belongs to public.accounts, not financial_facts.
-- The existing forecast functions already join accounts as `a`; patch their stored definitions
-- so operating cash-flow calculations use a.cash_flow_direct_category.
DO $$
DECLARE
  v_oid oid;
  v_def text;
BEGIN
  FOREACH v_oid IN ARRAY ARRAY[
    'public.get_executive_dashboard_forecast(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer)'::regprocedure::oid,
    'public.get_executive_dashboard_forecast_validation(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid)'::regprocedure::oid
  ] LOOP
    v_def := pg_get_functiondef(v_oid);
    IF position('f.cash_flow_direct_category' IN v_def) > 0 THEN
      v_def := replace(v_def, 'f.cash_flow_direct_category', 'a.cash_flow_direct_category');
      EXECUTE v_def;
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_executive_dashboard_forecast(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_executive_dashboard_forecast(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_executive_dashboard_forecast_validation(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_executive_dashboard_forecast_validation(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid) TO authenticated;
