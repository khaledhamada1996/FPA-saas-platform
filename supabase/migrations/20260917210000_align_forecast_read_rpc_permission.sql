-- Forecast is a standalone planning module. Its read RPCs must use the forecast screen permission,
-- not the Executive Dashboard permission.
DO $$
DECLARE r record; d text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN ('get_executive_dashboard_forecast','get_executive_dashboard_forecast_validation')
  LOOP
    d := pg_get_functiondef(r.oid);
    d := replace(d, 'screen.executive_dashboard.view', 'screen.forecast.view');
    EXECUTE d;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_executive_dashboard_forecast(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer), public.get_executive_dashboard_forecast_validation(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_executive_dashboard_forecast(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer), public.get_executive_dashboard_forecast_validation(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid) TO authenticated;