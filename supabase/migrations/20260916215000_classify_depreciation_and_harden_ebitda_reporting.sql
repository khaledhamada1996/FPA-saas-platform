-- Governed D&A classification and deterministic five-statement math validation.
-- Use explicit codes/names only; never infer classification from arbitrary account names.

update public.accounts
set statement_subclassification = 'depreciation_amortization',
    statement_section = 'الإهلاك والاستهلاك'
where statement_type = 'income_statement'
  and (
    code in ('6700','6710','6720','6730','6740')
    or name in ('الإهلاك والاستهلاك','مصروف إهلاك المباني','مصروف إهلاك السيارات','مصروف إهلاك الأثاث والأجهزة','مصروف إهلاك المعدات والآلات')
  )
  and statement_subclassification is distinct from 'depreciation_amortization';

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
  v_revenue bigint := 0; v_cogs bigint := 0; v_opex bigint := 0; v_other_income bigint := 0;
  v_da bigint := 0; v_finance_cost bigint := 0; v_other_expense bigint := 0; v_tax bigint := 0;
  v_assets bigint := 0; v_liabilities bigint := 0; v_equity bigint := 0;
  v_net_income bigint := 0; v_ebitda bigint := 0; v_ebit bigint := 0; v_ebt bigint := 0;
  v_balance_difference bigint := 0; v_classified_da_accounts integer := 0; v_da_period bigint := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=v_user_id) then raise exception 'Organization access required'; end if;
  if not (public.has_org_permission(p_organization_id,'screen.financial_statements.view') or public.has_org_permission(p_organization_id,'statements.view') or public.has_org_permission(p_organization_id,'view')) then raise exception 'Financial statements view permission required'; end if;

  select fp.id, fp.period_start, fp.period_end into v_period
  from public.financial_periods fp where fp.id=p_period_id and fp.organization_id=p_organization_id;
  if v_period.id is null then raise exception 'Financial period not found'; end if;

  select
    coalesce(sum(case when a.statement_subclassification='revenue' then f.credit_minor-f.debit_minor else 0 end),0),
    coalesce(sum(case when a.statement_subclassification='cogs' then f.debit_minor-f.credit_minor else 0 end),0),
    coalesce(sum(case when a.statement_subclassification='operating_expense' then f.debit_minor-f.credit_minor else 0 end),0),
    coalesce(sum(case when a.statement_subclassification='other_income' then f.credit_minor-f.debit_minor else 0 end),0),
    coalesce(sum(case when a.statement_subclassification='depreciation_amortization' then f.debit_minor-f.credit_minor else 0 end),0),
    coalesce(sum(case when a.statement_subclassification='finance_cost' then f.debit_minor-f.credit_minor else 0 end),0),
    coalesce(sum(case when a.statement_subclassification='other_expense' then f.debit_minor-f.credit_minor else 0 end),0),
    coalesce(sum(case when a.statement_subclassification='tax' then f.debit_minor-f.credit_minor else 0 end),0)
  into v_revenue,v_cogs,v_opex,v_other_income,v_da,v_finance_cost,v_other_expense,v_tax
  from public.financial_facts f
  join public.accounts a on a.id=f.account_id and a.organization_id=p_organization_id
  where f.organization_id=p_organization_id and f.financial_period_id=p_period_id
    and f.fact_type='actual' and f.status='published'
    and public.has_org_data_scope(f.organization_id,'legal_entity',f.legal_entity_id)
    and public.has_org_data_scope(f.organization_id,'branch',f.branch_id)
    and public.has_org_data_scope(f.organization_id,'department',f.department_id)
    and public.has_org_data_scope(f.organization_id,'cost_center',f.cost_center_id)
    and public.has_org_data_scope(f.organization_id,'region',f.region_id)
    and public.has_org_data_scope(f.organization_id,'product',f.product_id)
    and public.has_org_data_scope(f.organization_id,'project',f.project_id)
    and (p_branch_id is null or f.branch_id=p_branch_id)
    and (p_department_id is null or f.department_id=p_department_id)
    and (p_cost_center_id is null or f.cost_center_id=p_cost_center_id)
    and (p_region_id is null or f.region_id=p_region_id)
    and (p_product_id is null or f.product_id=p_product_id)
    and (p_project_id is null or f.project_id=p_project_id)
    and (p_account_id is null or f.account_id=p_account_id);

  v_ebitda := v_revenue-v_cogs-v_opex+v_other_income;
  v_ebit := v_ebitda-v_da;
  v_ebt := v_ebit-v_finance_cost-v_other_expense;
  v_net_income := v_ebt-v_tax;

  select
    coalesce(sum(case when a.statement_subclassification='asset' then f.debit_minor-f.credit_minor else 0 end),0),
    coalesce(sum(case when a.statement_subclassification='liability' then -(f.debit_minor-f.credit_minor) else 0 end),0),
    coalesce(sum(case when a.statement_subclassification='equity' then -(f.debit_minor-f.credit_minor) else 0 end),0)
  into v_assets,v_liabilities,v_equity
  from public.financial_facts f
  join public.accounts a on a.id=f.account_id and a.organization_id=p_organization_id
  join public.financial_periods fp on fp.id=f.financial_period_id
  where f.organization_id=p_organization_id and fp.period_end<=v_period.period_end
    and f.fact_type='actual' and f.status='published'
    and lower(coalesce(a.statement_type,''))='balance_sheet'
    and a.statement_subclassification in ('asset','liability','equity')
    and public.has_org_data_scope(f.organization_id,'legal_entity',f.legal_entity_id)
    and public.has_org_data_scope(f.organization_id,'branch',f.branch_id)
    and public.has_org_data_scope(f.organization_id,'department',f.department_id)
    and public.has_org_data_scope(f.organization_id,'cost_center',f.cost_center_id)
    and public.has_org_data_scope(f.organization_id,'region',f.region_id)
    and public.has_org_data_scope(f.organization_id,'product',f.product_id)
    and public.has_org_data_scope(f.organization_id,'project',f.project_id)
    and (p_branch_id is null or f.branch_id=p_branch_id)
    and (p_department_id is null or f.department_id=p_department_id)
    and (p_cost_center_id is null or f.cost_center_id=p_cost_center_id)
    and (p_region_id is null or f.region_id=p_region_id)
    and (p_product_id is null or f.product_id=p_product_id)
    and (p_project_id is null or f.project_id=p_project_id)
    and (p_account_id is null or f.account_id=p_account_id);

  v_balance_difference := v_assets-v_liabilities-v_equity;

  select count(*) into v_classified_da_accounts from public.accounts a
  where a.organization_id=p_organization_id and a.statement_type='income_statement'
    and a.statement_subclassification='depreciation_amortization';

  select coalesce(sum(f.debit_minor-f.credit_minor),0) into v_da_period
  from public.financial_facts f join public.accounts a on a.id=f.account_id
  where f.organization_id=p_organization_id and f.financial_period_id=p_period_id
    and f.fact_type='actual' and f.status='published' and a.statement_subclassification='depreciation_amortization';

  return jsonb_build_object(
    'status',case when v_balance_difference=0 and v_ebitda=(v_ebit+v_da) then 'passed' else 'failed' end,
    'income_statement',jsonb_build_object('revenue',v_revenue,'cogs',v_cogs,'operating_expenses',v_opex,'other_income',v_other_income,'depreciation_amortization',v_da,'ebitda',v_ebitda,'ebit',v_ebit,'finance_cost',v_finance_cost,'other_expenses',v_other_expense,'ebt',v_ebt,'tax',v_tax,'net_income',v_net_income,'ebitda_reconciliation_difference',v_ebitda-(v_ebit+v_da)),
    'balance_sheet',jsonb_build_object('total_assets',v_assets,'total_liabilities',v_liabilities,'total_equity',v_equity,'balance_difference',v_balance_difference),
    'classification',jsonb_build_object('depreciation_amortization_accounts',v_classified_da_accounts,'period_depreciation_amortization',v_da_period)
  );
end;
$$;

grant execute on function public.validate_financial_statement_math(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;
revoke execute on function public.validate_financial_statement_math(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) from anon;
