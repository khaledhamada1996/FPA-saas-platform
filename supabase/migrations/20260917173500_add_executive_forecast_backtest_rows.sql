-- Add rolling forecast backtest detail rows to the existing validation RPC.
-- Uses the same published-actuals, tenant-scope, and six-observed-month methodology as forecast validation.

CREATE OR REPLACE FUNCTION public.get_executive_dashboard_forecast_validation(
 p_organization_id uuid,p_start_date date,p_end_date date,
 p_branch_id uuid DEFAULT NULL,p_department_id uuid DEFAULT NULL,p_cost_center_id uuid DEFAULT NULL,
 p_region_id uuid DEFAULT NULL,p_product_id uuid DEFAULT NULL,p_project_id uuid DEFAULT NULL,p_account_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' SET statement_timeout TO '15s' AS $function$
DECLARE v_user_id uuid := auth.uid(); v_result jsonb;
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN RAISE EXCEPTION 'Invalid date range'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id=p_organization_id AND om.user_id=v_user_id) THEN RAISE EXCEPTION 'Organization access required'; END IF;
 IF NOT public.has_org_permission(p_organization_id,'screen.executive_dashboard.view') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 WITH scope_flags AS MATERIALIZED (
   SELECT coalesce(array_agg(s.scope_id) FILTER(WHERE s.scope_type='legal_entity'),'{}'::uuid[]) legal_entities,
          coalesce(array_agg(s.scope_id) FILTER(WHERE s.scope_type='branch'),'{}'::uuid[]) branches,
          coalesce(array_agg(s.scope_id) FILTER(WHERE s.scope_type='department'),'{}'::uuid[]) departments,
          coalesce(array_agg(s.scope_id) FILTER(WHERE s.scope_type='cost_center'),'{}'::uuid[]) cost_centers,
          coalesce(array_agg(s.scope_id) FILTER(WHERE s.scope_type='region'),'{}'::uuid[]) regions,
          coalesce(array_agg(s.scope_id) FILTER(WHERE s.scope_type='product'),'{}'::uuid[]) products,
          coalesce(array_agg(s.scope_id) FILTER(WHERE s.scope_type='project'),'{}'::uuid[]) projects,
          count(*)>0 has_any
   FROM public.organization_member_scopes s WHERE s.organization_id=p_organization_id AND s.user_id=v_user_id
 ),
 facts AS MATERIALIZED (
   SELECT f.debit_minor,f.credit_minor,f.transaction_date,a.statement_subclassification,a.cash_flow_direct_category AS cash_flow_direct_category,
          f.account_id,f.legal_entity_id,f.branch_id,f.department_id,f.cost_center_id,f.region_id,f.product_id,f.project_id
   FROM public.financial_facts f JOIN public.accounts a ON a.id=f.account_id AND a.organization_id=p_organization_id
   CROSS JOIN scope_flags sf
   WHERE f.organization_id=p_organization_id AND f.fact_type='actual' AND f.status='published'
     AND f.transaction_date BETWEEN p_start_date AND p_end_date
     AND (p_branch_id IS NULL OR f.branch_id=p_branch_id) AND (p_department_id IS NULL OR f.department_id=p_department_id)
     AND (p_cost_center_id IS NULL OR f.cost_center_id=p_cost_center_id) AND (p_region_id IS NULL OR f.region_id=p_region_id)
     AND (p_product_id IS NULL OR f.product_id=p_product_id) AND (p_project_id IS NULL OR f.project_id=p_project_id)
     AND (p_account_id IS NULL OR f.account_id=p_account_id)
     AND (NOT sf.has_any OR cardinality(sf.legal_entities)=0 OR f.legal_entity_id IS NULL OR f.legal_entity_id=ANY(sf.legal_entities))
     AND (NOT sf.has_any OR cardinality(sf.branches)=0 OR f.branch_id IS NULL OR f.branch_id=ANY(sf.branches))
     AND (NOT sf.has_any OR cardinality(sf.departments)=0 OR f.department_id IS NULL OR f.department_id=ANY(sf.departments))
     AND (NOT sf.has_any OR cardinality(sf.cost_centers)=0 OR f.cost_center_id IS NULL OR f.cost_center_id=ANY(sf.cost_centers))
     AND (NOT sf.has_any OR cardinality(sf.regions)=0 OR f.region_id IS NULL OR f.region_id=ANY(sf.regions))
     AND (NOT sf.has_any OR cardinality(sf.products)=0 OR f.product_id IS NULL OR f.product_id=ANY(sf.products))
     AND (NOT sf.has_any OR cardinality(sf.projects)=0 OR f.project_id IS NULL OR f.project_id=ANY(sf.projects))
 ),
 months AS (SELECT gs::date month_start FROM generate_series(date_trunc('month',p_start_date)::date,date_trunc('month',p_end_date)::date,interval '1 month') gs),
 monthly AS (
   SELECT m.month_start,
     coalesce(sum(CASE WHEN f.statement_subclassification='revenue' THEN f.credit_minor-f.debit_minor ELSE 0 END),0)::numeric revenue,
     coalesce(sum(CASE WHEN f.statement_subclassification='cogs' THEN f.debit_minor-f.credit_minor ELSE 0 END),0)::numeric cogs,
     coalesce(sum(CASE WHEN f.statement_subclassification='operating_expense' THEN f.debit_minor-f.credit_minor ELSE 0 END),0)::numeric opex,
     coalesce(sum(CASE WHEN f.statement_subclassification='other_income' THEN f.credit_minor-f.debit_minor ELSE 0 END),0)::numeric other_income,
     coalesce(sum(CASE WHEN f.statement_subclassification='depreciation_amortization' THEN f.debit_minor-f.credit_minor ELSE 0 END),0)::numeric da,
     coalesce(sum(CASE WHEN f.statement_subclassification='finance_cost' THEN f.debit_minor-f.credit_minor ELSE 0 END),0)::numeric finance,
     coalesce(sum(CASE WHEN f.statement_subclassification='other_expense' THEN f.debit_minor-f.credit_minor ELSE 0 END),0)::numeric other_expense,
     coalesce(sum(CASE WHEN f.statement_subclassification='tax' THEN f.debit_minor-f.credit_minor ELSE 0 END),0)::numeric tax,
     coalesce(sum(CASE WHEN f.cash_flow_direct_category='operating_inflow' THEN f.credit_minor-f.debit_minor WHEN f.cash_flow_direct_category='operating_outflow' THEN f.debit_minor-f.credit_minor ELSE 0 END),0)::numeric operating_cash_flow
   FROM months m LEFT JOIN facts f ON f.transaction_date BETWEEN m.month_start AND (m.month_start+interval '1 month - 1 day')::date GROUP BY m.month_start
 ),
 observed AS (SELECT *,row_number() OVER(order by month_start) rn FROM monthly WHERE revenue<>0 OR cogs<>0 OR opex<>0 OR other_income<>0 OR da<>0 OR finance<>0 OR other_expense<>0 OR tax<>0 OR operating_cash_flow<>0),
 targets AS (SELECT * FROM observed WHERE rn>(SELECT max(rn)-3 FROM observed) AND rn>=7),
 backtest AS (
   SELECT t.month_start,t.rn,t.revenue,t.cogs,t.opex,t.other_income,t.da,t.finance,t.other_expense,t.tax,t.operating_cash_flow,
          s.rev_slope,s.rev_intercept,s.cogs_slope,s.cogs_intercept,s.opex_slope,s.opex_intercept,s.oi_slope,s.oi_intercept,s.da_slope,s.da_intercept,s.fin_slope,s.fin_intercept,s.oe_slope,s.oe_intercept,s.tax_slope,s.tax_intercept,s.ocf_slope,s.ocf_intercept
   FROM targets t CROSS JOIN LATERAL (
     SELECT regr_slope(r.revenue,extract(epoch FROM r.month_start)/2629800.0) rev_slope,regr_intercept(r.revenue,extract(epoch FROM r.month_start)/2629800.0) rev_intercept,
            regr_slope(r.cogs,extract(epoch FROM r.month_start)/2629800.0) cogs_slope,regr_intercept(r.cogs,extract(epoch FROM r.month_start)/2629800.0) cogs_intercept,
            regr_slope(r.opex,extract(epoch FROM r.month_start)/2629800.0) opex_slope,regr_intercept(r.opex,extract(epoch FROM r.month_start)/2629800.0) opex_intercept,
            regr_slope(r.other_income,extract(epoch FROM r.month_start)/2629800.0) oi_slope,regr_intercept(r.other_income,extract(epoch FROM r.month_start)/2629800.0) oi_intercept,
            regr_slope(r.da,extract(epoch FROM r.month_start)/2629800.0) da_slope,regr_intercept(r.da,extract(epoch FROM r.month_start)/2629800.0) da_intercept,
            regr_slope(r.finance,extract(epoch FROM r.month_start)/2629800.0) fin_slope,regr_intercept(r.finance,extract(epoch FROM r.month_start)/2629800.0) fin_intercept,
            regr_slope(r.other_expense,extract(epoch FROM r.month_start)/2629800.0) oe_slope,regr_intercept(r.other_expense,extract(epoch FROM r.month_start)/2629800.0) oe_intercept,
            regr_slope(r.tax,extract(epoch FROM r.month_start)/2629800.0) tax_slope,regr_intercept(r.tax,extract(epoch FROM r.month_start)/2629800.0) tax_intercept,
            regr_slope(r.operating_cash_flow,extract(epoch FROM r.month_start)/2629800.0) ocf_slope,regr_intercept(r.operating_cash_flow,extract(epoch FROM r.month_start)/2629800.0) ocf_intercept
     FROM observed r WHERE r.rn BETWEEN t.rn-6 AND t.rn-1
   ) s
 ),
 predicted AS (
   SELECT b.*,greatest(0,coalesce(b.rev_slope*extract(epoch FROM b.month_start)/2629800.0+b.rev_intercept,0))::numeric revenue_f,
          greatest(0,coalesce(b.cogs_slope*extract(epoch FROM b.month_start)/2629800.0+b.cogs_intercept,0))::numeric cogs_f,
          greatest(0,coalesce(b.opex_slope*extract(epoch FROM b.month_start)/2629800.0+b.opex_intercept,0))::numeric opex_f,
          greatest(0,coalesce(b.oi_slope*extract(epoch FROM b.month_start)/2629800.0+b.oi_intercept,0))::numeric oi_f,
          greatest(0,coalesce(b.da_slope*extract(epoch FROM b.month_start)/2629800.0+b.da_intercept,0))::numeric da_f,
          greatest(0,coalesce(b.fin_slope*extract(epoch FROM b.month_start)/2629800.0+b.fin_intercept,0))::numeric fin_f,
          greatest(0,coalesce(b.oe_slope*extract(epoch FROM b.month_start)/2629800.0+b.oe_intercept,0))::numeric oe_f,
          greatest(0,coalesce(b.tax_slope*extract(epoch FROM b.month_start)/2629800.0+b.tax_intercept,0))::numeric tax_f,
          coalesce(b.ocf_slope*extract(epoch FROM b.month_start)/2629800.0+b.ocf_intercept,0)::numeric ocf_f
   FROM backtest b
 ),
 scored AS (
   SELECT p.*,
     (p.revenue-p.cogs)::numeric actual_gross_profit,(p.revenue-p.cogs-p.opex+p.other_income)::numeric actual_ebitda,
     (p.revenue-p.cogs-p.opex+p.other_income-p.da-p.finance-p.other_expense-p.tax)::numeric actual_net_income,
     (p.revenue_f-p.cogs_f)::numeric forecast_gross_profit,(p.revenue_f-p.cogs_f-p.opex_f+p.oi_f)::numeric forecast_ebitda,
     (p.revenue_f-p.cogs_f-p.opex_f+p.oi_f-p.da_f-p.fin_f-p.oe_f-p.tax_f)::numeric forecast_net_income
   FROM predicted p
 ),
 errors AS (
   SELECT s.*,CASE WHEN s.revenue<>0 THEN abs(s.revenue-s.revenue_f)/abs(s.revenue)*100 END revenue_ape,
     CASE WHEN s.actual_gross_profit<>0 THEN abs(s.actual_gross_profit-s.forecast_gross_profit)/abs(s.actual_gross_profit)*100 END gross_profit_ape,
     CASE WHEN s.actual_ebitda<>0 THEN abs(s.actual_ebitda-s.forecast_ebitda)/abs(s.actual_ebitda)*100 END ebitda_ape,
     CASE WHEN s.operating_cash_flow<>0 THEN abs(s.operating_cash_flow-s.ocf_f)/abs(s.operating_cash_flow)*100 END operating_cash_flow_ape
   FROM scored s
 ), summary AS (
   SELECT count(*)::integer backtest_months,round(avg(revenue_ape)::numeric,2) revenue_mape,round(avg(gross_profit_ape)::numeric,2) gross_profit_mape,round(avg(ebitda_ape)::numeric,2) ebitda_mape,round(avg(operating_cash_flow_ape)::numeric,2) operating_cash_flow_mape FROM errors
 ), scored_summary AS (
   SELECT s.*,round((SELECT avg(v)::numeric FROM (VALUES(s.revenue_mape),(s.gross_profit_mape),(s.ebitda_mape),(s.operating_cash_flow_mape)) q(v) WHERE v IS NOT NULL),2) overall_mape FROM summary s
 ), rows_payload AS (
   SELECT coalesce(jsonb_agg(jsonb_build_object(
     'month',to_char(e.month_start,'YYYY-MM'),
     'actual',jsonb_build_object('revenue',round(e.revenue)::bigint,'gross_profit',round(e.actual_gross_profit)::bigint,'ebitda',round(e.actual_ebitda)::bigint,'net_income',round(e.actual_net_income)::bigint,'operating_cash_flow',round(e.operating_cash_flow)::bigint),
     'forecast',jsonb_build_object('revenue',round(e.revenue_f)::bigint,'gross_profit',round(e.forecast_gross_profit)::bigint,'ebitda',round(e.forecast_ebitda)::bigint,'net_income',round(e.forecast_net_income)::bigint,'operating_cash_flow',round(e.ocf_f)::bigint),
     'variance',jsonb_build_object('revenue',round(e.revenue-e.revenue_f)::bigint,'gross_profit',round(e.actual_gross_profit-e.forecast_gross_profit)::bigint,'ebitda',round(e.actual_ebitda-e.forecast_ebitda)::bigint,'net_income',round(e.actual_net_income-e.forecast_net_income)::bigint,'operating_cash_flow',round(e.operating_cash_flow-e.ocf_f)::bigint),
     'ape',jsonb_build_object('revenue',round(e.revenue_ape::numeric,2),'gross_profit',round(e.gross_profit_ape::numeric,2),'ebitda',round(e.ebitda_ape::numeric,2),'operating_cash_flow',round(e.operating_cash_flow_ape::numeric,2))
   ) ORDER BY e.month_start),'[]'::jsonb) rows FROM errors e
 )
 SELECT jsonb_build_object(
   'validated',(SELECT backtest_months>=3 FROM scored_summary),'backtest_months',(SELECT backtest_months FROM scored_summary),'minimum_backtest_months',3,
   'metrics',jsonb_build_object('revenue_mape',(SELECT revenue_mape FROM scored_summary),'gross_profit_mape',(SELECT gross_profit_mape FROM scored_summary),'ebitda_mape',(SELECT ebitda_mape FROM scored_summary),'operating_cash_flow_mape',(SELECT operating_cash_flow_mape FROM scored_summary),'overall_mape',(SELECT overall_mape FROM scored_summary)),
   'quality',CASE WHEN (SELECT backtest_months FROM scored_summary)<3 OR (SELECT overall_mape FROM scored_summary) IS NULL THEN 'insufficient' WHEN (SELECT overall_mape FROM scored_summary)<=10 THEN 'high' WHEN (SELECT overall_mape FROM scored_summary)<=20 THEN 'moderate' ELSE 'low' END,
   'rows',(SELECT rows FROM rows_payload),
   'methodology',jsonb_build_object('model','linear_trend_over_last_6_observed_months','validation','rolling_holdout_up_to_3_latest_observed_months','error_metric','MAPE','actuals_only',true,'published_only',true,'missing_months_excluded',true,'filters_applied',true)
 ) INTO v_result;
 RETURN v_result;
END; $function$;

REVOKE ALL ON FUNCTION public.get_executive_dashboard_forecast_validation(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_executive_dashboard_forecast_validation(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid) TO authenticated;
