-- Keep dynamic reporting filters accessible to the standalone Forecast module.
-- Forecast has its own screen permission and must not depend on Executive Dashboard,
-- Financial Statements, or Financial Analysis permissions for filter-option loading.
DO $$
DECLARE v_sql text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_sql
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='get_dynamic_reporting_filter_options'
    AND p.oid::regprocedure::text='get_dynamic_reporting_filter_options(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date)';
  IF v_sql IS NULL THEN RAISE EXCEPTION 'dynamic reporting filter function not found'; END IF;
  IF position(E'public.has_org_permission(p_organization_id,''screen.variance.view'')\n    or public.has_org_permission(p_organization_id,''view'')' in v_sql)=0 THEN RAISE EXCEPTION 'expected permission clause not found'; END IF;
  v_sql := replace(v_sql,
    E'public.has_org_permission(p_organization_id,''screen.variance.view'')\n    or public.has_org_permission(p_organization_id,''view'')',
    E'public.has_org_permission(p_organization_id,''screen.variance.view'')\n    or public.has_org_permission(p_organization_id,''screen.forecast.view'')\n    or public.has_org_permission(p_organization_id,''view'')');
  EXECUTE v_sql;
END $$;
