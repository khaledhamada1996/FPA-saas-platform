create or replace function public.get_financial_statements(p_organization_id uuid, p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_period record;
  v_rows jsonb;
  v_income jsonb;
  v_balance jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.has_org_permission(p_organization_id, 'screen.financial_statements.view')
    or public.has_org_permission(p_organization_id, 'statements.view')
  ) then
    raise exception 'Financial statements view permission required';
  end if;

  select id, organization_id, period_start, period_end, status
    into v_period
  from public.financial_periods
  where id = p_period_id
    and organization_id = p_organization_id;

  if v_period.id is null then
    raise exception 'Financial period not found';
  end if;

  with scoped_facts as (
    select f.*
    from public.financial_facts f
    where f.organization_id = p_organization_id
      and f.financial_period_id = p_period_id
      and f.fact_type = 'actual'
      and f.status = 'published'
      and public.has_org_data_scope(f.organization_id, 'legal_entity', f.legal_entity_id)
      and public.has_org_data_scope(f.organization_id, 'branch', f.branch_id)
      and public.has_org_data_scope(f.organization_id, 'department', f.department_id)
      and public.has_org_data_scope(f.organization_id, 'cost_center', f.cost_center_id)
      and public.has_org_data_scope(f.organization_id, 'region', f.region_id)
      and public.has_org_data_scope(f.organization_id, 'product', f.product_id)
      and public.has_org_data_scope(f.organization_id, 'project', f.project_id)
  ),
  balances as (
    select
      a.id,
      a.code,
      a.name,
      a.statement_type,
      a.statement_section,
      a.account_type,
      a.normal_balance,
      coalesce(sum(f.debit_minor), 0)::bigint as debit,
      coalesce(sum(f.credit_minor), 0)::bigint as credit,
      coalesce(sum(f.amount_minor), 0)::bigint as balance
    from public.accounts a
    left join scoped_facts f on f.account_id = a.id
    where a.organization_id = p_organization_id
    group by a.id, a.code, a.name, a.statement_type, a.statement_section, a.account_type, a.normal_balance
  ),
  income as (
    select * from balances
    where lower(coalesce(statement_type, '')) in ('income','income_statement','profit_and_loss','p&l','pnl')
       or lower(coalesce(account_type, '')) in ('revenue','income','expense','cost_of_sales','cogs')
  ),
  bs as (
    select * from balances
    where lower(coalesce(statement_type, '')) in ('balance_sheet','balance sheet','bs','financial_position')
       or lower(coalesce(account_type, '')) in ('asset','liability','equity')
  ),
  ir as (
    select
      coalesce(sum(case when lower(coalesce(account_type,'')) in ('revenue','income') then credit-debit else 0 end),0)::bigint revenue,
      coalesce(sum(case when lower(coalesce(account_type,'')) in ('cost_of_sales','cogs') then debit-credit else 0 end),0)::bigint cogs,
      coalesce(sum(case when lower(coalesce(account_type,'')) in ('expense','operating_expense','operating_expenses') then debit-credit else 0 end),0)::bigint operating_expenses,
      coalesce(sum(case when lower(coalesce(account_type,'')) in ('finance_cost','finance_expense') then debit-credit else 0 end),0)::bigint finance_cost,
      coalesce(sum(case when lower(coalesce(account_type,'')) in ('tax','income_tax') then debit-credit else 0 end),0)::bigint tax
    from income
  )
  select jsonb_build_object(
    'revenue', revenue,
    'cogs', cogs,
    'gross_profit', revenue-cogs,
    'operating_expenses', operating_expenses,
    'ebitda', revenue-cogs-operating_expenses,
    'finance_cost', finance_cost,
    'ebt', revenue-cogs-operating_expenses-finance_cost,
    'tax', tax,
    'net_income', revenue-cogs-operating_expenses-finance_cost-tax
  )
  into v_income
  from ir;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', code,
        'name', name,
        'section', statement_section,
        'account_type', account_type,
        'debit', debit,
        'credit', credit,
        'balance', balance
      ) order by code
    ), '[]'::jsonb
  )
  into v_rows
  from bs;

  v_balance = jsonb_build_object(
    'accounts', v_rows,
    'total_assets', coalesce((select sum(case when lower(coalesce(account_type,''))='asset' then balance else 0 end) from bs),0),
    'total_liabilities', coalesce((select sum(case when lower(coalesce(account_type,''))='liability' then -balance else 0 end) from bs),0),
    'total_equity', coalesce((select sum(case when lower(coalesce(account_type,''))='equity' then -balance else 0 end) from bs),0)
  );

  return jsonb_build_object(
    'period', jsonb_build_object('id',v_period.id,'start',v_period.period_start,'end',v_period.period_end,'status',v_period.status),
    'income_statement', v_income,
    'balance_sheet', v_balance
  );
end;
$function$;

revoke execute on function public.get_financial_statements(uuid, uuid) from anon;
grant execute on function public.get_financial_statements(uuid, uuid) to authenticated;
