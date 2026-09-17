-- Refine Forecast quality governance and rename the user-facing permission label.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.get_executive_dashboard_forecast_validation(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid)'::regprocedure)
  INTO v_def;

  v_def := replace(
    v_def,
    $$'quality',CASE WHEN (SELECT backtest_months FROM scored_summary)<3 OR (SELECT overall_mape FROM scored_summary) IS NULL THEN 'insufficient' WHEN (SELECT overall_mape FROM scored_summary)<=10 THEN 'high' WHEN (SELECT overall_mape FROM scored_summary)<=20 THEN 'moderate' ELSE 'low' END$$,
    $$'quality',CASE
      WHEN (SELECT backtest_months FROM scored_summary)<3 OR (SELECT overall_mape FROM scored_summary) IS NULL THEN 'insufficient'
      WHEN (SELECT max(v) FROM (VALUES((SELECT revenue_mape FROM scored_summary)),((SELECT gross_profit_mape FROM scored_summary)),((SELECT ebitda_mape FROM scored_summary)),((SELECT operating_cash_flow_mape FROM scored_summary))) q(v) WHERE v IS NOT NULL)>50 THEN 'low'
      WHEN (SELECT overall_mape FROM scored_summary)<=10 THEN 'high'
      WHEN (SELECT overall_mape FROM scored_summary)<=30 THEN 'moderate'
      ELSE 'low'
    END$$
  );

  v_def := replace(
    v_def,
    $$'methodology',jsonb_build_object('model','linear_trend_over_last_6_observed_months','validation','rolling_holdout_up_to_3_latest_observed_months','error_metric','MAPE','actuals_only',true,'published_only',true,'missing_months_excluded',true,'filters_applied',true)$$,
    $$'methodology',jsonb_build_object('model','linear_trend_over_last_6_observed_months','validation','rolling_holdout_up_to_3_latest_observed_months','error_metric','MAPE','quality_rules',jsonb_build_object('insufficient','backtest_months<3_or_overall_mape_null','high','overall_mape<=10_and_no_metric_mape_above_50','moderate','overall_mape<=30_and_no_metric_mape_above_50','low','any_metric_mape>50_or_overall_mape>30'),'actuals_only',true,'published_only',true,'missing_months_excluded',true,'filters_applied',true)$$
  );

  EXECUTE v_def;
END $$;

UPDATE public.organization_permissions
SET name='عرض التنبؤ المالي', description='عرض شاشة التنبؤ المالي'
WHERE permission_key='forecast.view';