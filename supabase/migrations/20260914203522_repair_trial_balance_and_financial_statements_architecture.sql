-- Financial reporting architecture repair.
-- Adds a governed statement subclassification and rebuilds Trial Balance around
-- published facts, fiscal-year-aware opening balances, and explicit debit/credit columns.

alter table public.accounts add column if not exists statement_subclassification text;

alter table public.accounts drop constraint if exists accounts_statement_subclassification_check;
alter table public.accounts add constraint accounts_statement_subclassification_check
  check (statement_subclassification is null or statement_subclassification in (
    'revenue','cogs','operating_expense','other_income','depreciation_amortization',
    'finance_cost','tax','other_expense','asset','liability','equity'
  ));

update public.accounts
set statement_subclassification = case
  when lower(coalesce(statement_type,''))='balance_sheet' and lower(coalesce(account_type,''))='asset' then 'asset'
  when lower(coalesce(statement_type,''))='balance_sheet' and lower(coalesce(account_type,''))='liability' then 'liability'
  when lower(coalesce(statement_type,''))='balance_sheet' and lower(coalesce(account_type,''))='equity' then 'equity'
  when lower(coalesce(statement_type,''))='income_statement' and lower(coalesce(account_type,'')) in ('revenue','income') then 'revenue'
  when lower(coalesce(statement_type,''))='income_statement' and lower(coalesce(statement_section,''))='تكلفة المبيعات' then 'cogs'
  when lower(coalesce(statement_type,''))='income_statement' and lower(coalesce(statement_section,''))='المصروفات التشغيلية' then 'operating_expense'
  else statement_subclassification
end
where statement_subclassification is null;

create index if not exists accounts_statement_reporting_idx
  on public.accounts (organization_id, statement_type, statement_subclassification);

create or replace function public.get_trial_balance(p_organization_id uuid, p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_period record;
  v_fiscal_month smallint;
  v_fiscal_year_start date;
  v_row_count integer;
  v_total_debit bigint;
  v_total_credit bigint;
  v_total_opening_debit bigint;
  v_total_opening_credit bigint;
  v_total_closing_debit bigint;
  v_total_closing_credit bigint;
  v_rows jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_organization_id is null or p_period_id is null then raise exception 'Organization and period are required'; end if;
  if not public.has_org_permission(p_organization_id,'view') then raise exception 'Not authorized'; end if;

  select fp.id,fp.organization_id,fp.period_start,fp.period_end,fp.status,o.fiscal_year_start_month
    into v_period
  from public.financial_periods fp
  join public.organizations o on o.id=fp.organization_id
  where fp.id=p_period_id and fp.organization_id=p_organization_id;
  if v_period.id is null then raise exception 'Financial period not found'; end if;

  v_fiscal_month:=greatest(1,least(12,v_period.fiscal_year_start_month));
  v_fiscal_year_start:=make_date(
    extract(year from v_period.period_start)::integer
      - case when extract(month from v_period.period_start)::integer < v_fiscal_month then 1 else 0 end,
    v_fiscal_month,1);

  with scoped_facts as (
    select ff.account_id,ff.financial_period_id,
      coalesce(ff.debit_minor,0)::bigint debit_minor,
      coalesce(ff.credit_minor,0)::bigint credit_minor
    from public.financial_facts ff
    where ff.organization_id=p_organization_id
      and ff.fact_type='actual'
      and ff.status='published'
      and public.has_org_data_scope(ff.organization_id,'legal_entity',ff.legal_entity_id)
      and public.has_org_data_scope(ff.organization_id,'branch',ff.branch_id)
      and public.has_org_data_scope(ff.organization_id,'department',ff.department_id)
      and public.has_org_data_scope(ff.organization_id,'cost_center',ff.cost_center_id)
      and public.has_org_data_scope(ff.organization_id,'region',ff.region_id)
      and public.has_org_data_scope(ff.organization_id,'product',ff.product_id)
      and public.has_org_data_scope(ff.organization_id,'project',ff.project_id)
  ), account_period as (
    select a.id account_id,a.code,a.name,a.account_type,a.statement_type,a.statement_section,a.statement_subclassification,
      coalesce(sum(case when fp.period_start<v_period.period_start and (lower(coalesce(a.statement_type,''))='balance_sheet' or fp.period_start>=v_fiscal_year_start) then sf.debit_minor else 0 end),0)::bigint opening_debit,
      coalesce(sum(case when fp.period_start<v_period.period_start and (lower(coalesce(a.statement_type,''))='balance_sheet' or fp.period_start>=v_fiscal_year_start) then sf.credit_minor else 0 end),0)::bigint opening_credit,
      coalesce(sum(case when fp.id=p_period_id then sf.debit_minor else 0 end),0)::bigint period_debit,
      coalesce(sum(case when fp.id=p_period_id then sf.credit_minor else 0 end),0)::bigint period_credit
    from public.accounts a
    join scoped_facts sf on sf.account_id=a.id
    join public.financial_periods fp on fp.id=sf.financial_period_id and fp.organization_id=p_organization_id
    where a.organization_id=p_organization_id
    group by a.id,a.code,a.name,a.account_type,a.statement_type,a.statement_section,a.statement_subclassification
  ), normalized as (
    select *, (opening_debit-opening_credit+period_debit-period_credit)::bigint closing_balance
    from account_period
    where opening_debit<>0 or opening_credit<>0 or period_debit<>0 or period_credit<>0
  ), final_rows as (
    select account_id,code,name,account_type,statement_type,statement_section,statement_subclassification,
      opening_debit,opening_credit,period_debit,period_credit,
      case when closing_balance>0 then closing_balance else 0 end::bigint closing_debit,
      case when closing_balance<0 then -closing_balance else 0 end::bigint closing_credit
    from normalized
  )
  select count(*),coalesce(sum(period_debit),0),coalesce(sum(period_credit),0),
    coalesce(sum(opening_debit),0),coalesce(sum(opening_credit),0),
    coalesce(sum(closing_debit),0),coalesce(sum(closing_credit),0),
    coalesce(jsonb_agg(to_jsonb(final_rows) order by code),'[]'::jsonb)
  into v_row_count,v_total_debit,v_total_credit,v_total_opening_debit,v_total_opening_credit,
       v_total_closing_debit,v_total_closing_credit,v_rows
  from final_rows;

  return jsonb_build_object(
    'organization_id',p_organization_id,'period_id',v_period.id,
    'period_start',v_period.period_start,'period_end',v_period.period_end,'period_status',v_period.status,
    'fiscal_year_start',v_fiscal_year_start,'row_count',v_row_count,
    'total_period_debit',v_total_debit,'total_period_credit',v_total_credit,'period_difference',v_total_debit-v_total_credit,
    'total_opening_debit',v_total_opening_debit,'total_opening_credit',v_total_opening_credit,'opening_difference',v_total_opening_debit-v_total_opening_credit,
    'total_closing_debit',v_total_closing_debit,'total_closing_credit',v_total_closing_credit,'closing_difference',v_total_closing_debit-v_total_closing_credit,
    'rows',v_rows);
end;
$function$;

revoke all on function public.get_trial_balance(uuid,uuid) from public,anon;
grant execute on function public.get_trial_balance(uuid,uuid) to authenticated;
