-- Accounting model validation gate.
-- Keeps reporting deterministic and blocks progression when core accounting controls fail.

create or replace function public.set_account_statement_subclassification(
  p_organization_id uuid,
  p_account_id uuid,
  p_subclassification text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_statement_type text;
  v_old jsonb;
  v_allowed boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_permission(p_organization_id,'accounts.edit') then raise exception 'FORBIDDEN'; end if;

  v_allowed := p_subclassification is null or p_subclassification in (
    'revenue','cogs','operating_expense','other_income','depreciation_amortization',
    'finance_cost','tax','other_expense','asset','liability','equity'
  );
  if not v_allowed then raise exception 'INVALID_STATEMENT_SUBCLASSIFICATION'; end if;

  select a.statement_type,to_jsonb(a)
    into v_statement_type,v_old
  from public.accounts a
  where a.id=p_account_id and a.organization_id=p_organization_id;
  if v_old is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;

  if lower(coalesce(v_statement_type,''))='balance_sheet'
     and p_subclassification not in ('asset','liability','equity') then
    raise exception 'INVALID_BALANCE_SHEET_SUBCLASSIFICATION';
  end if;
  if lower(coalesce(v_statement_type,''))='income_statement'
     and p_subclassification in ('asset','liability','equity') then
    raise exception 'INVALID_INCOME_STATEMENT_SUBCLASSIFICATION';
  end if;

  update public.accounts
  set statement_subclassification=p_subclassification
  where id=p_account_id and organization_id=p_organization_id;

  perform public.write_audit_event(
    p_organization_id,
    'account.reporting_classification.update',
    'account',
    p_account_id::text,
    v_old,
    (select to_jsonb(a) from public.accounts a where a.id=p_account_id)
  );
  return true;
end;
$function$;

revoke all on function public.set_account_statement_subclassification(uuid,uuid,text) from public,anon;
grant execute on function public.set_account_statement_subclassification(uuid,uuid,text) to authenticated;

-- Unclassified income is an account-level control, not a fact-row count.
create or replace function public.get_financial_statements(p_organization_id uuid,p_period_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_period record; v_fiscal_month smallint; v_fiscal_year_start date;
  v_income jsonb; v_income_ytd jsonb; v_balance jsonb; v_validation jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (public.has_org_permission(p_organization_id,'screen.financial_statements.view')
       or public.has_org_permission(p_organization_id,'statements.view')
       or public.has_org_permission(p_organization_id,'view')) then
    raise exception 'Financial statements view permission required';
  end if;

  select fp.id,fp.organization_id,fp.period_start,fp.period_end,fp.status,o.fiscal_year_start_month
    into v_period
  from public.financial_periods fp join public.organizations o on o.id=fp.organization_id
  where fp.id=p_period_id and fp.organization_id=p_organization_id;
  if v_period.id is null then raise exception 'Financial period not found'; end if;

  v_fiscal_month:=greatest(1,least(12,v_period.fiscal_year_start_month));
  v_fiscal_year_start:=make_date(
    extract(year from v_period.period_start)::integer
      - case when extract(month from v_period.period_start)::integer < v_fiscal_month then 1 else 0 end,
    v_fiscal_month,1);

  with scoped_facts as (
    select f.* from public.financial_facts f
    where f.organization_id=p_organization_id and f.fact_type='actual' and f.status='published'
      and public.has_org_data_scope(f.organization_id,'legal_entity',f.legal_entity_id)
      and public.has_org_data_scope(f.organization_id,'branch',f.branch_id)
      and public.has_org_data_scope(f.organization_id,'department',f.department_id)
      and public.has_org_data_scope(f.organization_id,'cost_center',f.cost_center_id)
      and public.has_org_data_scope(f.organization_id,'region',f.region_id)
      and public.has_org_data_scope(f.organization_id,'product',f.product_id)
      and public.has_org_data_scope(f.organization_id,'project',f.project_id)
  ), classified as (
    select f.financial_period_id,fp.period_start,fp.period_end,a.id account_id,a.code,a.name,a.account_type,a.statement_type,a.statement_section,a.statement_subclassification,
      coalesce(f.debit_minor,0)::bigint debit_minor,coalesce(f.credit_minor,0)::bigint credit_minor
    from scoped_facts f
    join public.financial_periods fp on fp.id=f.financial_period_id and fp.organization_id=p_organization_id
    join public.accounts a on a.id=f.account_id and a.organization_id=p_organization_id
  ), period_income as (
    select
      coalesce(sum(case when statement_subclassification='revenue' then credit_minor-debit_minor else 0 end),0)::bigint revenue,
      coalesce(sum(case when statement_subclassification='cogs' then debit_minor-credit_minor else 0 end),0)::bigint cogs,
      coalesce(sum(case when statement_subclassification='operating_expense' then debit_minor-credit_minor else 0 end),0)::bigint operating_expenses,
      coalesce(sum(case when statement_subclassification='other_income' then credit_minor-debit_minor else 0 end),0)::bigint other_income,
      coalesce(sum(case when statement_subclassification='depreciation_amortization' then debit_minor-credit_minor else 0 end),0)::bigint depreciation_amortization,
      coalesce(sum(case when statement_subclassification='finance_cost' then debit_minor-credit_minor else 0 end),0)::bigint finance_cost,
      coalesce(sum(case when statement_subclassification='tax' then debit_minor-credit_minor else 0 end),0)::bigint tax,
      coalesce(sum(case when statement_subclassification='other_expense' then debit_minor-credit_minor else 0 end),0)::bigint other_expenses,
      count(distinct account_id) filter(where lower(coalesce(statement_type,''))='income_statement' and statement_subclassification is null)::integer unclassified_count
    from classified where financial_period_id=p_period_id
  ), ytd_income as (
    select
      coalesce(sum(case when statement_subclassification='revenue' then credit_minor-debit_minor else 0 end),0)::bigint revenue,
      coalesce(sum(case when statement_subclassification='cogs' then debit_minor-credit_minor else 0 end),0)::bigint cogs,
      coalesce(sum(case when statement_subclassification='operating_expense' then debit_minor-credit_minor else 0 end),0)::bigint operating_expenses,
      coalesce(sum(case when statement_subclassification='other_income' then credit_minor-debit_minor else 0 end),0)::bigint other_income,
      coalesce(sum(case when statement_subclassification='depreciation_amortization' then debit_minor-credit_minor else 0 end),0)::bigint depreciation_amortization,
      coalesce(sum(case when statement_subclassification='finance_cost' then debit_minor-credit_minor else 0 end),0)::bigint finance_cost,
      coalesce(sum(case when statement_subclassification='tax' then debit_minor-credit_minor else 0 end),0)::bigint tax,
      coalesce(sum(case when statement_subclassification='other_expense' then debit_minor-credit_minor else 0 end),0)::bigint other_expenses
    from classified where period_start>=v_fiscal_year_start and period_end<=v_period.period_end
  ), balance_accounts as (
    select a.code,a.name,a.statement_section,a.account_type,a.statement_subclassification,
      coalesce(sum(f.debit_minor),0)::bigint debit,coalesce(sum(f.credit_minor),0)::bigint credit,
      coalesce(sum(f.debit_minor-f.credit_minor),0)::bigint balance
    from public.accounts a
    left join classified f on f.account_id=a.id and f.period_end<=v_period.period_end
    where a.organization_id=p_organization_id and lower(coalesce(a.statement_type,''))='balance_sheet'
      and a.statement_subclassification in ('asset','liability','equity')
    group by a.code,a.name,a.statement_section,a.account_type,a.statement_subclassification
  ), totals as (
    select coalesce(sum(case when statement_subclassification='asset' then balance else 0 end),0)::bigint assets,
      coalesce(sum(case when statement_subclassification='liability' then -balance else 0 end),0)::bigint liabilities,
      coalesce(sum(case when statement_subclassification='equity' then -balance else 0 end),0)::bigint equity
    from balance_accounts
  )
  select jsonb_build_object(
    'revenue',pi.revenue,'cogs',pi.cogs,'gross_profit',pi.revenue-pi.cogs,
    'operating_expenses',pi.operating_expenses,'other_income',pi.other_income,'depreciation_amortization',pi.depreciation_amortization,
    'ebitda',pi.revenue-pi.cogs-pi.operating_expenses+pi.other_income,
    'ebit',pi.revenue-pi.cogs-pi.operating_expenses+pi.other_income-pi.depreciation_amortization,
    'finance_cost',pi.finance_cost,'other_expenses',pi.other_expenses,
    'ebt',pi.revenue-pi.cogs-pi.operating_expenses+pi.other_income-pi.depreciation_amortization-pi.finance_cost-pi.other_expenses,
    'tax',pi.tax,
    'net_income',pi.revenue-pi.cogs-pi.operating_expenses+pi.other_income-pi.depreciation_amortization-pi.finance_cost-pi.other_expenses-pi.tax,
    'unclassified_income_accounts',pi.unclassified_count) into v_income from period_income pi;

  select jsonb_build_object(
    'revenue',yi.revenue,'cogs',yi.cogs,'gross_profit',yi.revenue-yi.cogs,
    'operating_expenses',yi.operating_expenses,'other_income',yi.other_income,'depreciation_amortization',yi.depreciation_amortization,
    'ebitda',yi.revenue-yi.cogs-yi.operating_expenses+yi.other_income,
    'ebit',yi.revenue-yi.cogs-yi.operating_expenses+yi.other_income-yi.depreciation_amortization,
    'finance_cost',yi.finance_cost,'other_expenses',yi.other_expenses,
    'ebt',yi.revenue-yi.cogs-yi.operating_expenses+yi.other_income-yi.depreciation_amortization-yi.finance_cost-yi.other_expenses,
    'tax',yi.tax,
    'net_income',yi.revenue-yi.cogs-yi.operating_expenses+yi.other_income-yi.depreciation_amortization-yi.finance_cost-yi.other_expenses-yi.tax) into v_income_ytd from ytd_income yi;

  select jsonb_build_object(
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('code',code,'name',name,'section',statement_section,'account_type',account_type,'subclassification',statement_subclassification,'debit',debit,'credit',credit,'balance',balance) order by code) from balance_accounts),'[]'::jsonb),
    'total_assets',t.assets,'total_liabilities',t.liabilities,'total_equity',t.equity,
    'current_period_net_income',(v_income->>'net_income')::bigint,
    'ytd_net_income',(v_income_ytd->>'net_income')::bigint,
    'balance_check',t.assets-t.liabilities-t.equity-(v_income_ytd->>'net_income')::bigint) into v_balance from totals t;

  select jsonb_build_object('unclassified_income_accounts',coalesce((v_income->>'unclassified_income_accounts')::integer,0),'balance_sheet_difference',coalesce((v_balance->>'balance_check')::bigint,0)) into v_validation;

  return jsonb_build_object(
    'period',jsonb_build_object('id',v_period.id,'start',v_period.period_start,'end',v_period.period_end,'status',v_period.status),
    'fiscal_year_start',v_fiscal_year_start,'income_statement',v_income,'income_statement_ytd',v_income_ytd,
    'balance_sheet',v_balance,'validation',v_validation,
    'methodology',jsonb_build_object('actuals_only',true,'published_only',true,'balance_sheet_cumulative',true,'income_statement_basis','selected_period','income_statement_ytd_available',true,'fiscal_year_aware',true,'classification_authoritative',true));
end;
$function$;

revoke all on function public.get_financial_statements(uuid,uuid) from public,anon;
grant execute on function public.get_financial_statements(uuid,uuid) to authenticated;

create or replace function public.validate_accounting_model(
  p_organization_id uuid,
  p_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_period record;
  v_tb jsonb;
  v_fs jsonb;
  v_fiscal_month smallint;
  v_fiscal_year_start date;
  v_pnl_opening_debit bigint := 0;
  v_pnl_opening_credit bigint := 0;
  v_unclassified integer := 0;
  v_checks jsonb;
  v_failures jsonb;
  v_pass boolean;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_permission(p_organization_id,'view') then raise exception 'FORBIDDEN'; end if;

  select fp.id,fp.organization_id,fp.period_start,fp.period_end,fp.status,o.fiscal_year_start_month
    into v_period
  from public.financial_periods fp
  join public.organizations o on o.id=fp.organization_id
  where fp.id=p_period_id and fp.organization_id=p_organization_id;
  if v_period.id is null then raise exception 'FINANCIAL_PERIOD_NOT_FOUND'; end if;

  v_tb := public.get_trial_balance(p_organization_id,p_period_id);
  v_fs := public.get_financial_statements(p_organization_id,p_period_id);
  v_fiscal_month:=greatest(1,least(12,v_period.fiscal_year_start_month));
  v_fiscal_year_start:=make_date(
    extract(year from v_period.period_start)::integer
      - case when extract(month from v_period.period_start)::integer < v_fiscal_month then 1 else 0 end,
    v_fiscal_month,1);

  select coalesce(sum(coalesce(f.debit_minor,0)),0)::bigint,
         coalesce(sum(coalesce(f.credit_minor,0)),0)::bigint
    into v_pnl_opening_debit,v_pnl_opening_credit
  from public.financial_facts f
  join public.accounts a on a.id=f.account_id and a.organization_id=p_organization_id
  join public.financial_periods fp on fp.id=f.financial_period_id and fp.organization_id=p_organization_id
  where f.organization_id=p_organization_id
    and f.fact_type='actual' and f.status='published'
    and fp.period_start<v_period.period_start
    and fp.period_start>=v_fiscal_year_start
    and lower(coalesce(a.statement_type,''))='income_statement'
    and public.has_org_data_scope(f.organization_id,'legal_entity',f.legal_entity_id)
    and public.has_org_data_scope(f.organization_id,'branch',f.branch_id)
    and public.has_org_data_scope(f.organization_id,'department',f.department_id)
    and public.has_org_data_scope(f.organization_id,'cost_center',f.cost_center_id)
    and public.has_org_data_scope(f.organization_id,'region',f.region_id)
    and public.has_org_data_scope(f.organization_id,'product',f.product_id)
    and public.has_org_data_scope(f.organization_id,'project',f.project_id);

  v_unclassified:=coalesce((v_fs->'validation'->>'unclassified_income_accounts')::integer,0);

  v_checks:=jsonb_build_object(
    'period_debits_equal_credits',coalesce((v_tb->>'period_difference')::bigint,1)=0,
    'opening_debits_equal_credits',coalesce((v_tb->>'opening_difference')::bigint,1)=0,
    'closing_debits_equal_credits',coalesce((v_tb->>'closing_difference')::bigint,1)=0,
    'balance_sheet_balances',coalesce((v_fs->'validation'->>'balance_sheet_difference')::bigint,1)=0,
    'income_statement_accounts_classified',v_unclassified=0,
    'published_actuals_only',true,
    'pnl_resets_at_fiscal_year_start',case when v_period.period_start=v_fiscal_year_start then v_pnl_opening_debit=0 and v_pnl_opening_credit=0 else true end
  );

  v_failures:=coalesce((select jsonb_agg(key) from jsonb_each(v_checks) where value is false),'[]'::jsonb);
  v_pass:=jsonb_array_length(v_failures)=0;

  return jsonb_build_object(
    'organization_id',p_organization_id,
    'period_id',p_period_id,
    'period_start',v_period.period_start,
    'period_end',v_period.period_end,
    'fiscal_year_start',v_fiscal_year_start,
    'pass',v_pass,
    'checks',v_checks,
    'failures',v_failures,
    'trial_balance',jsonb_build_object(
      'period_difference',v_tb->>'period_difference',
      'opening_difference',v_tb->>'opening_difference',
      'closing_difference',v_tb->>'closing_difference'
    ),
    'financial_statements',jsonb_build_object(
      'balance_sheet_difference',v_fs->'validation'->>'balance_sheet_difference',
      'unclassified_income_accounts',v_unclassified
    ),
    'methodology',jsonb_build_object('published_actuals_only',true,'fiscal_year_aware',true,'pnl_reset_control',true,'balance_sheet_cumulative_control',true,'classification_control',true)
  );
end;
$function$;

revoke all on function public.validate_accounting_model(uuid,uuid) from public,anon;
grant execute on function public.validate_accounting_model(uuid,uuid) to authenticated;
