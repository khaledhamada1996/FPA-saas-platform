create or replace function public.validate_financial_statement_math(
  p_organization_id uuid,
  p_period_id uuid,
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
set search_path to ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_period record;
  v_result jsonb;
  v_da_accounts integer := 0;
  v_da_period bigint := 0;
  v_ebitda bigint := 0;
  v_ebit bigint := 0;
  v_da bigint := 0;
  v_income_diff bigint := 0;
  v_balance_diff bigint := 0;
  v_equity_diff bigint := 0;
  v_cash_diff bigint := 0;
  v_indirect_cash_diff bigint := 0;
  v_oci bigint := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=v_user_id) then raise exception 'Organization access required'; end if;
  if not (public.has_org_permission(p_organization_id,'screen.financial_statements.view') or public.has_org_permission(p_organization_id,'statements.view') or public.has_org_permission(p_organization_id,'view')) then raise exception 'Financial statements view permission required'; end if;

  select fp.id, fp.period_start, fp.period_end into v_period
  from public.financial_periods fp where fp.id=p_period_id and fp.organization_id=p_organization_id;
  if v_period.id is null then raise exception 'Financial period not found'; end if;

  v_result := public.get_financial_statements_date_range_filtered(
    p_organization_id,v_period.period_start,v_period.period_end,null,'indirect',
    p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_account_id
  );

  v_da := coalesce((v_result->'income_statement'->>'depreciation_amortization')::bigint,0);
  v_ebitda := coalesce((v_result->'income_statement'->>'ebitda')::bigint,0);
  v_ebit := coalesce((v_result->'income_statement'->>'ebit')::bigint,0);
  v_income_diff := v_ebitda-(v_ebit+v_da);
  v_balance_diff := coalesce((v_result->'validation'->>'balance_sheet_difference')::bigint,0);
  v_equity_diff := coalesce((v_result->'validation'->>'equity_rollforward_difference')::bigint,0);
  v_cash_diff := coalesce((v_result->'validation'->>'cash_flow_reconciliation_difference')::bigint,0);
  v_indirect_cash_diff := coalesce((v_result->'validation'->>'indirect_cash_flow_reconciliation_difference')::bigint,0);
  v_oci := coalesce((v_result->'other_comprehensive_income'->'period'->>'total')::bigint,0);

  select count(*) into v_da_accounts
  from public.accounts a
  where a.organization_id=p_organization_id and a.statement_type='income_statement' and a.statement_subclassification='depreciation_amortization';

  select coalesce(sum(f.debit_minor-f.credit_minor),0) into v_da_period
  from public.financial_facts f join public.accounts a on a.id=f.account_id and a.organization_id=p_organization_id
  where f.organization_id=p_organization_id and f.financial_period_id=p_period_id
    and f.fact_type='actual' and f.status='published' and a.statement_subclassification='depreciation_amortization';

  return jsonb_build_object(
    'status',case when v_income_diff=0 and v_balance_diff=0 and v_equity_diff=0 and v_cash_diff=0 and v_indirect_cash_diff=0 then 'passed' else 'failed' end,
    'income_statement',jsonb_build_object('ebitda',v_ebitda,'depreciation_amortization',v_da,'ebit',v_ebit,'ebitda_reconciliation_difference',v_income_diff),
    'balance_sheet',jsonb_build_object('balance_difference',v_balance_diff),
    'equity_statement',jsonb_build_object('rollforward_difference',v_equity_diff),
    'cash_flow',jsonb_build_object('direct_reconciliation_difference',v_cash_diff,'indirect_reconciliation_difference',v_indirect_cash_diff),
    'other_comprehensive_income',jsonb_build_object('period_total',v_oci),
    'classification',jsonb_build_object('depreciation_amortization_accounts',v_da_accounts,'period_depreciation_amortization',v_da_period),
    'methodology',jsonb_build_object('source','canonical_financial_statement_engine','actuals_only',true,'published_only',true)
  );
end;
$$;

grant execute on function public.validate_financial_statement_math(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;
revoke execute on function public.validate_financial_statement_math(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) from anon;
