create or replace function public.get_executive_dashboard_forecast_validation(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_branch_id uuid default null,
  p_department_id uuid default null,
  p_cost_center_id uuid default null,
  p_region_id uuid default null,
  p_product_id uuid default null,
  p_project_id uuid default null,
  p_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '15s'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then raise exception 'Invalid date range'; end if;
  if not exists (select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=v_user_id) then raise exception 'Organization access required'; end if;
  if not public.has_org_permission(p_organization_id,'screen.executive_dashboard.view') then raise exception 'Not authorized'; end if;
  with scope_flags as materialized (
    select coalesce(array_agg(s.scope_id) filter(where s.scope_type='legal_entity'),'{}'::uuid[]) legal_entities,
           coalesce(array_agg(s.scope_id) filter(where s.scope_type='branch'),'{}'::uuid[]) branches,
           coalesce(array_agg(s.scope_id) filter(where s.scope_type='department'),'{}'::uuid[]) departments,
           coalesce(array_agg(s.scope_id) filter(where s.scope_type='cost_center'),'{}'::uuid[]) cost_centers,
           coalesce(array_agg(s.scope_id) filter(where s.scope_type='region'),'{}'::uuid[]) regions,
           coalesce(array_agg(s.scope_id) filter(where s.scope_type='product'),'{}'::uuid[]) products,
           coalesce(array_agg(s.scope_id) filter(where s.scope_type='project'),'{}'::uuid[]) projects,
           count(*)>0 has_any
    from public.organization_member_scopes s
    where s.organization_id=p_organization_id and s.user_id=v_user_id
  ),
  facts as materialized (
    select f.debit_minor,f.credit_minor,f.transaction_date,a.statement_subclassification,
           a.cash_flow_direct_category as cash_flow_direct_category,f.account_id,f.legal_entity_id,
           f.branch_id,f.department_id,f.cost_center_id,f.region_id,f.product_id,f.project_id
    from public.financial_facts f
    join public.accounts a on a.id=f.account_id and a.organization_id=p_organization_id
    cross join scope_flags sf
    where f.organization_id=p_organization_id and f.fact_type='actual' and f.status='published'
      and f.transaction_date between p_start_date and p_end_date
      and (p_branch_id is null or f.branch_id=p_branch_id)
      and (p_department_id is null or f.department_id=p_department_id)
      and (p_cost_center_id is null or f.cost_center_id=p_cost_center_id)
      and (p_region_id is null or f.region_id=p_region_id)
      and (p_product_id is null or f.product_id=p_product_id)
      and (p_project_id is null or f.project_id=p_project_id)
      and (p_account_id is null or f.account_id=p_account_id)
      and (not sf.has_any or cardinality(sf.legal_entities)=0 or f.legal_entity_id is null or f.legal_entity_id=any(sf.legal_entities))
      and (not sf.has_any or cardinality(sf.branches)=0 or f.branch_id is null or f.branch_id=any(sf.branches))
      and (not sf.has_any or cardinality(sf.departments)=0 or f.department_id is null or f.department_id=any(sf.departments))
      and (not sf.has_any or cardinality(sf.cost_centers)=0 or f.cost_center_id is null or f.cost_center_id=any(sf.cost_centers))
      and (not sf.has_any or cardinality(sf.regions)=0 or f.region_id is null or f.region_id=any(sf.regions))
      and (not sf.has_any or cardinality(sf.products)=0 or f.product_id is null or f.product_id=any(sf.products))
      and (not sf.has_any or cardinality(sf.projects)=0 or f.project_id is null or f.project_id=any(sf.projects))
  ),
  months as (
    select gs::date month_start
    from generate_series(date_trunc('month',p_start_date)::date,date_trunc('month',p_end_date)::date,interval '1 month') gs
  ),
  monthly as (
    select m.month_start,
      coalesce(sum(case when f.statement_subclassification='revenue' then f.credit_minor-f.debit_minor else 0 end),0)::numeric revenue,
      coalesce(sum(case when f.statement_subclassification='cogs' then f.debit_minor-f.credit_minor else 0 end),0)::numeric cogs,
      coalesce(sum(case when f.statement_subclassification='operating_expense' then f.debit_minor-f.credit_minor else 0 end),0)::numeric opex,
      coalesce(sum(case when f.statement_subclassification='other_income' then f.credit_minor-f.debit_minor else 0 end),0)::numeric other_income,
      coalesce(sum(case when f.statement_subclassification='depreciation_amortization' then f.debit_minor-f.credit_minor else 0 end),0)::numeric da,
      coalesce(sum(case when f.statement_subclassification='finance_cost' then f.debit_minor-f.credit_minor else 0 end),0)::numeric finance,
      coalesce(sum(case when f.statement_subclassification='other_expense' then f.debit_minor-f.credit_minor else 0 end),0)::numeric other_expense,
      coalesce(sum(case when f.statement_subclassification='tax' then f.debit_minor-f.credit_minor else 0 end),0)::numeric tax,
      coalesce(sum(case when f.cash_flow_direct_category='operating_inflow' then f.credit_minor-f.debit_minor when f.cash_flow_direct_category='operating_outflow' then f.debit_minor-f.credit_minor else 0 end),0)::numeric operating_cash_flow
    from months m left join facts f on f.transaction_date between m.month_start and (m.month_start+interval '1 month - 1 day')::date
    group by m.month_start
  ),
  observed as (
    select *,row_number() over(order by month_start) rn from monthly
    where revenue<>0 or cogs<>0 or opex<>0 or other_income<>0 or da<>0 or finance<>0 or other_expense<>0 or tax<>0 or operating_cash_flow<>0
  ),
  targets as (
    select * from observed where rn>(select max(rn)-3 from observed) and rn>=7
  ),
  backtest as (
    select t.month_start,t.rn,t.revenue,t.cogs,t.opex,t.other_income,t.da,t.finance,t.other_expense,t.tax,t.operating_cash_flow,
           s.rev_slope,s.rev_intercept,s.cogs_slope,s.cogs_intercept,s.opex_slope,s.opex_intercept,s.oi_slope,s.oi_intercept,
           s.da_slope,s.da_intercept,s.fin_slope,s.fin_intercept,s.oe_slope,s.oe_intercept,s.tax_slope,s.tax_intercept,s.ocf_slope,s.ocf_intercept
    from targets t cross join lateral (
      select regr_slope(r.revenue,extract(epoch from r.month_start)/2629800.0) rev_slope,regr_intercept(r.revenue,extract(epoch from r.month_start)/2629800.0) rev_intercept,
             regr_slope(r.cogs,extract(epoch from r.month_start)/2629800.0) cogs_slope,regr_intercept(r.cogs,extract(epoch from r.month_start)/2629800.0) cogs_intercept,
             regr_slope(r.opex,extract(epoch from r.month_start)/2629800.0) opex_slope,regr_intercept(r.opex,extract(epoch from r.month_start)/2629800.0) opex_intercept,
             regr_slope(r.other_income,extract(epoch from r.month_start)/2629800.0) oi_slope,regr_intercept(r.other_income,extract(epoch from r.month_start)/2629800.0) oi_intercept,
             regr_slope(r.da,extract(epoch from r.month_start)/2629800.0) da_slope,regr_intercept(r.da,extract(epoch from r.month_start)/2629800.0) da_intercept,
             regr_slope(r.finance,extract(epoch from r.month_start)/2629800.0) fin_slope,regr_intercept(r.finance,extract(epoch from r.month_start)/2629800.0) fin_intercept,
             regr_slope(r.other_expense,extract(epoch from r.month_start)/2629800.0) oe_slope,regr_intercept(r.other_expense,extract(epoch from r.month_start)/2629800.0) oe_intercept,
             regr_slope(r.tax,extract(epoch from r.month_start)/2629800.0) tax_slope,regr_intercept(r.tax,extract(epoch from r.month_start)/2629800.0) tax_intercept,
             regr_slope(r.operating_cash_flow,extract(epoch from r.month_start)/2629800.0) ocf_slope,regr_intercept(r.operating_cash_flow,extract(epoch from r.month_start)/2629800.0) ocf_intercept
      from observed r where r.rn between t.rn-6 and t.rn-1
    ) s
  ),
  predicted as (
    select b.*,
      greatest(0,coalesce(b.rev_slope*extract(epoch from b.month_start)/2629800.0+b.rev_intercept,0))::numeric revenue_f,
      greatest(0,coalesce(b.cogs_slope*extract(epoch from b.month_start)/2629800.0+b.cogs_intercept,0))::numeric cogs_f,
      greatest(0,coalesce(b.opex_slope*extract(epoch from b.month_start)/2629800.0+b.opex_intercept,0))::numeric opex_f,
      greatest(0,coalesce(b.oi_slope*extract(epoch from b.month_start)/2629800.0+b.oi_intercept,0))::numeric oi_f,
      greatest(0,coalesce(b.da_slope*extract(epoch from b.month_start)/2629800.0+b.da_intercept,0))::numeric da_f,
      greatest(0,coalesce(b.fin_slope*extract(epoch from b.month_start)/2629800.0+b.fin_intercept,0))::numeric fin_f,
      greatest(0,coalesce(b.oe_slope*extract(epoch from b.month_start)/2629800.0+b.oe_intercept,0))::numeric oe_f,
      greatest(0,coalesce(b.tax_slope*extract(epoch from b.month_start)/2629800.0+b.tax_intercept,0))::numeric tax_f,
      coalesce(b.ocf_slope*extract(epoch from b.month_start)/2629800.0+b.ocf_intercept,0)::numeric ocf_f
    from backtest b
  ),
  scored as (
    select p.*,
      (p.revenue-p.cogs)::numeric actual_gross_profit,(p.revenue-p.cogs-p.opex+p.other_income)::numeric actual_ebitda,
      (p.revenue-p.cogs-p.opex+p.other_income-p.da-p.finance-p.other_expense-p.tax)::numeric actual_net_income,
      (p.revenue_f-p.cogs_f)::numeric forecast_gross_profit,(p.revenue_f-p.cogs_f-p.opex_f+p.oi_f)::numeric forecast_ebitda,
      (p.revenue_f-p.cogs_f-p.opex_f+p.oi_f-p.da_f-p.fin_f-p.oe_f-p.tax_f)::numeric forecast_net_income
    from predicted p
  ),
  errors as (
    select s.*,
      case when s.revenue<>0 then abs(s.revenue-s.revenue_f)/abs(s.revenue)*100 end revenue_ape,
      case when s.actual_gross_profit<>0 then abs(s.actual_gross_profit-s.forecast_gross_profit)/abs(s.actual_gross_profit)*100 end gross_profit_ape,
      case when s.actual_ebitda<>0 then abs(s.actual_ebitda-s.forecast_ebitda)/abs(s.actual_ebitda)*100 end ebitda_ape,
      case when s.operating_cash_flow<>0 then abs(s.operating_cash_flow-s.ocf_f)/abs(s.operating_cash_flow)*100 end operating_cash_flow_ape
    from scored s
  ),
  summary as (
    select count(*)::integer backtest_months,round(avg(revenue_ape)::numeric,2) revenue_mape,round(avg(gross_profit_ape)::numeric,2) gross_profit_mape,
           round(avg(ebitda_ape)::numeric,2) ebitda_mape,round(avg(operating_cash_flow_ape)::numeric,2) operating_cash_flow_mape from errors
  ),
  scored_summary as (
    select s.*,round((select avg(v)::numeric from (values(s.revenue_mape),(s.gross_profit_mape),(s.ebitda_mape),(s.operating_cash_flow_mape)) q(v) where v is not null),2) overall_mape from summary s
  ),
  rows_payload as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'month',to_char(e.month_start,'YYYY-MM'),
      'actual',jsonb_build_object('revenue',round(e.revenue)::bigint,'gross_profit',round(e.actual_gross_profit)::bigint,'ebitda',round(e.actual_ebitda)::bigint,'net_income',round(e.actual_net_income)::bigint,'operating_cash_flow',round(e.operating_cash_flow)::bigint),
      'forecast',jsonb_build_object('revenue',round(e.revenue_f)::bigint,'gross_profit',round(e.forecast_gross_profit)::bigint,'ebitda',round(e.forecast_ebitda)::bigint,'net_income',round(e.forecast_net_income)::bigint,'operating_cash_flow',round(e.ocf_f)::bigint),
      'variance',jsonb_build_object('revenue',round(e.revenue-e.revenue_f)::bigint,'gross_profit',round(e.actual_gross_profit-e.forecast_gross_profit)::bigint,'ebitda',round(e.actual_ebitda-e.forecast_ebitda)::bigint,'net_income',round(e.actual_net_income-e.forecast_net_income)::bigint,'operating_cash_flow',round(e.operating_cash_flow-e.ocf_f)::bigint),
      'ape',jsonb_build_object('revenue',round(e.revenue_ape::numeric,2),'gross_profit',round(e.gross_profit_ape::numeric,2),'ebitda',round(e.ebitda_ape::numeric,2),'operating_cash_flow',round(e.operating_cash_flow_ape::numeric,2))
    ) order by e.month_start),'[]'::jsonb) rows from errors e
  )
  select jsonb_build_object(
    'validated',(select backtest_months>=3 from scored_summary),
    'backtest_months',(select backtest_months from scored_summary),
    'minimum_backtest_months',3,
    'metrics',jsonb_build_object('revenue_mape',(select revenue_mape from scored_summary),'gross_profit_mape',(select gross_profit_mape from scored_summary),'ebitda_mape',(select ebitda_mape from scored_summary),'operating_cash_flow_mape',(select operating_cash_flow_mape from scored_summary),'overall_mape',(select overall_mape from scored_summary)),
    'quality',case when (select backtest_months from scored_summary)<3 or (select overall_mape from scored_summary) is null then 'insufficient' when (select overall_mape from scored_summary)<=10 then 'high' when (select overall_mape from scored_summary)<=20 then 'moderate' else 'low' end,
    'rows',(select rows from rows_payload),
    'methodology',jsonb_build_object('model','linear_trend_over_last_6_observed_months','validation','rolling_holdout_up_to_3_latest_observed_months','error_metric','MAPE','actuals_only',true,'published_only',true,'missing_months_excluded',true,'filters_applied',true)
  ) into v_result;
  return v_result;
end;
$function$;

revoke execute on function public.get_executive_dashboard_forecast_validation(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.get_executive_dashboard_forecast_validation(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;
