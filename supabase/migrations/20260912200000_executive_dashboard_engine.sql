create or replace function public.get_executive_dashboard(p_organization_id uuid, p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_analysis jsonb;
  v_statements jsonb;
  v_period record;
  v_current jsonb;
  v_metrics jsonb;
  v_alerts jsonb;
  v_health text := 'no_data';
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_organization_id is null or p_period_id is null then raise exception 'Organization and period are required'; end if;
  if not public.has_org_permission(p_organization_id, 'view') then raise exception 'Not authorized'; end if;
  select id, organization_id, period_start, period_end, status into v_period
  from public.financial_periods where id=p_period_id and organization_id=p_organization_id;
  if v_period.id is null then raise exception 'Financial period not found'; end if;
  v_analysis := public.get_financial_analysis(p_organization_id,p_period_id);
  v_statements := public.get_financial_statements(p_organization_id,p_period_id);
  v_current := v_analysis->'current';
  v_metrics := v_analysis->'metrics';
  if coalesce((v_current->>'revenue')::numeric,0)=0 then v_health:='no_revenue';
  elsif coalesce((v_current->>'net_income')::numeric,0)<0 then v_health:='loss';
  elsif coalesce((v_metrics->>'revenue_growth_pct')::numeric,0)<0 then v_health:='declining';
  else v_health:='healthy'; end if;
  select coalesce(jsonb_agg(x.alert order by x.priority),'[]'::jsonb) into v_alerts from (
    select 1 priority,jsonb_build_object('code','negative_net_income','severity','critical','title','صافي الربح سلبي','value',(v_current->>'net_income')::bigint) alert where coalesce((v_current->>'net_income')::numeric,0)<0
    union all
    select 2,jsonb_build_object('code','revenue_decline','severity','warning','title','الإيرادات أقل من الفترة السابقة','value',(v_metrics->>'revenue_growth_pct')::numeric) where (v_metrics->>'revenue_growth_pct') is not null and coalesce((v_metrics->>'revenue_growth_pct')::numeric,0)<0
    union all
    select 3,jsonb_build_object('code','high_opex','severity','warning','title','نسبة المصروفات التشغيلية مرتفعة','value',(v_metrics->>'operating_expense_ratio_pct')::numeric) where coalesce((v_metrics->>'operating_expense_ratio_pct')::numeric,0)>50
  ) x;
  return jsonb_build_object('organization_id',p_organization_id,'period',jsonb_build_object('id',v_period.id,'start',v_period.period_start,'end',v_period.period_end,'status',v_period.status),'health',v_health,'kpis',jsonb_build_object('revenue',v_current->'revenue','gross_profit',v_current->'gross_profit','ebitda',v_current->'ebitda','net_income',v_current->'net_income','revenue_growth_pct',v_metrics->'revenue_growth_pct','gross_margin_pct',v_metrics->'gross_margin_pct','ebitda_margin_pct',v_metrics->'ebitda_margin_pct','net_margin_pct',v_metrics->'net_margin_pct'),'income_statement',v_statements->'income_statement','balance_sheet',v_statements->'balance_sheet','alerts',v_alerts,'methodology',jsonb_build_object('source','published actual financial facts','ai_authoritative',false));
end;
$$;
revoke all on function public.get_executive_dashboard(uuid,uuid) from public;
revoke all on function public.get_executive_dashboard(uuid,uuid) from anon;
grant execute on function public.get_executive_dashboard(uuid,uuid) to authenticated;
