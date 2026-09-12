create or replace function public.get_financial_analysis(p_organization_id uuid, p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_period record;
  v_prior_period record;
  v_current record;
  v_prior record;
  v_revenue_growth bigint := null;
  v_revenue_growth_pct numeric := null;
  v_gross_margin numeric := null;
  v_ebitda_margin numeric := null;
  v_net_margin numeric := null;
  v_opex_ratio numeric := null;
  v_trend text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_organization_id is null or p_period_id is null then raise exception 'Organization and period are required'; end if;
  if not public.has_org_permission(p_organization_id, 'view') then raise exception 'Not authorized'; end if;

  select id, organization_id, period_start, period_end, status into v_period
  from public.financial_periods
  where id=p_period_id and organization_id=p_organization_id;
  if v_period.id is null then raise exception 'Financial period not found'; end if;

  select id, organization_id, period_start, period_end, status into v_prior_period
  from public.financial_periods
  where organization_id=p_organization_id and period_end < v_period.period_start
  order by period_end desc limit 1;

  with scoped_facts as (
    select ff.financial_period_id, ff.account_id,
      coalesce(ff.debit_minor,case when ff.amount_minor>0 then ff.amount_minor else 0 end)::bigint debit_minor,
      coalesce(ff.credit_minor,case when ff.amount_minor<0 then -ff.amount_minor else 0 end)::bigint credit_minor
    from public.financial_facts ff
    where ff.organization_id=p_organization_id and ff.fact_type='actual'
      and public.has_org_data_scope(ff.organization_id,'legal_entity',ff.legal_entity_id)
      and public.has_org_data_scope(ff.organization_id,'branch',ff.branch_id)
      and public.has_org_data_scope(ff.organization_id,'department',ff.department_id)
      and public.has_org_data_scope(ff.organization_id,'cost_center',ff.cost_center_id)
      and public.has_org_data_scope(ff.organization_id,'region',ff.region_id)
      and public.has_org_data_scope(ff.organization_id,'product',ff.product_id)
      and public.has_org_data_scope(ff.organization_id,'project',ff.project_id)
  ), classified as (
    select sf.financial_period_id,lower(coalesce(a.account_type,'')) account_type,sf.debit_minor,sf.credit_minor
    from scoped_facts sf join public.accounts a on a.id=sf.account_id and a.organization_id=p_organization_id
  )
  select
    coalesce(sum(case when account_type in ('revenue','income') then credit_minor-debit_minor else 0 end),0)::bigint revenue,
    coalesce(sum(case when account_type in ('cost_of_sales','cogs') then debit_minor-credit_minor else 0 end),0)::bigint cogs,
    coalesce(sum(case when account_type in ('expense','operating_expense','operating_expenses') then debit_minor-credit_minor else 0 end),0)::bigint operating_expenses,
    coalesce(sum(case when account_type in ('finance_cost','finance_expense') then debit_minor-credit_minor else 0 end),0)::bigint finance_cost,
    coalesce(sum(case when account_type in ('tax','income_tax') then debit_minor-credit_minor else 0 end),0)::bigint tax
  into v_current from classified where financial_period_id=p_period_id;

  if v_prior_period.id is not null then
    with scoped_facts as (
      select ff.account_id,
        coalesce(ff.debit_minor,case when ff.amount_minor>0 then ff.amount_minor else 0 end)::bigint debit_minor,
        coalesce(ff.credit_minor,case when ff.amount_minor<0 then -ff.amount_minor else 0 end)::bigint credit_minor
      from public.financial_facts ff
      where ff.organization_id=p_organization_id and ff.fact_type='actual' and ff.financial_period_id=v_prior_period.id
        and public.has_org_data_scope(ff.organization_id,'legal_entity',ff.legal_entity_id)
        and public.has_org_data_scope(ff.organization_id,'branch',ff.branch_id)
        and public.has_org_data_scope(ff.organization_id,'department',ff.department_id)
        and public.has_org_data_scope(ff.organization_id,'cost_center',ff.cost_center_id)
        and public.has_org_data_scope(ff.organization_id,'region',ff.region_id)
        and public.has_org_data_scope(ff.organization_id,'product',ff.product_id)
        and public.has_org_data_scope(ff.organization_id,'project',ff.project_id)
    ), classified as (
      select lower(coalesce(a.account_type,'')) account_type,sf.debit_minor,sf.credit_minor
      from scoped_facts sf join public.accounts a on a.id=sf.account_id and a.organization_id=p_organization_id
    )
    select
      coalesce(sum(case when account_type in ('revenue','income') then credit_minor-debit_minor else 0 end),0)::bigint revenue,
      coalesce(sum(case when account_type in ('cost_of_sales','cogs') then debit_minor-credit_minor else 0 end),0)::bigint cogs,
      coalesce(sum(case when account_type in ('expense','operating_expense','operating_expenses') then debit_minor-credit_minor else 0 end),0)::bigint operating_expenses,
      coalesce(sum(case when account_type in ('finance_cost','finance_expense') then debit_minor-credit_minor else 0 end),0)::bigint finance_cost,
      coalesce(sum(case when account_type in ('tax','income_tax') then debit_minor-credit_minor else 0 end),0)::bigint tax
    into v_prior from classified;
  else
    v_prior := row(0::bigint,0::bigint,0::bigint,0::bigint,0::bigint);
  end if;

  if v_prior_period.id is not null and v_prior.revenue <> 0 then
    v_revenue_growth := v_current.revenue-v_prior.revenue;
    v_revenue_growth_pct := round((v_revenue_growth::numeric/abs(v_prior.revenue)::numeric)*100,2);
  end if;
  if v_current.revenue <> 0 then
    v_gross_margin := round(((v_current.revenue-v_current.cogs)::numeric/abs(v_current.revenue)::numeric)*100,2);
    v_ebitda_margin := round(((v_current.revenue-v_current.cogs-v_current.operating_expenses)::numeric/abs(v_current.revenue)::numeric)*100,2);
    v_net_margin := round(((v_current.revenue-v_current.cogs-v_current.operating_expenses-v_current.finance_cost-v_current.tax)::numeric/abs(v_current.revenue)::numeric)*100,2);
    v_opex_ratio := round((v_current.operating_expenses::numeric/abs(v_current.revenue)::numeric)*100,2);
  end if;

  if v_prior_period.id is null then v_trend:='no_prior_period';
  elsif v_current.revenue>v_prior.revenue then v_trend:='up';
  elsif v_current.revenue<v_prior.revenue then v_trend:='down';
  else v_trend:='flat'; end if;

  return jsonb_build_object(
    'organization_id',p_organization_id,
    'period',jsonb_build_object('id',v_period.id,'start',v_period.period_start,'end',v_period.period_end,'status',v_period.status),
    'prior_period',case when v_prior_period.id is null then null else jsonb_build_object('id',v_prior_period.id,'start',v_prior_period.period_start,'end',v_prior_period.period_end,'status',v_prior_period.status) end,
    'current',jsonb_build_object('revenue',v_current.revenue,'cogs',v_current.cogs,'gross_profit',v_current.revenue-v_current.cogs,'operating_expenses',v_current.operating_expenses,'ebitda',v_current.revenue-v_current.cogs-v_current.operating_expenses,'finance_cost',v_current.finance_cost,'tax',v_current.tax,'net_income',v_current.revenue-v_current.cogs-v_current.operating_expenses-v_current.finance_cost-v_current.tax),
    'prior',case when v_prior_period.id is null then null else jsonb_build_object('revenue',v_prior.revenue,'cogs',v_prior.cogs,'gross_profit',v_prior.revenue-v_prior.cogs,'operating_expenses',v_prior.operating_expenses,'ebitda',v_prior.revenue-v_prior.cogs-v_prior.operating_expenses,'finance_cost',v_prior.finance_cost,'tax',v_prior.tax,'net_income',v_prior.revenue-v_prior.cogs-v_prior.operating_expenses-v_prior.finance_cost-v_prior.tax) end,
    'metrics',jsonb_build_object('revenue_change',v_revenue_growth,'revenue_growth_pct',v_revenue_growth_pct,'gross_margin_pct',v_gross_margin,'ebitda_margin_pct',v_ebitda_margin,'net_margin_pct',v_net_margin,'operating_expense_ratio_pct',v_opex_ratio,'revenue_trend',v_trend),
    'methodology',jsonb_build_object('source','published actual financial facts','ai_authoritative',false,'prior_period','immediately preceding financial period by period_end')
  );
end;
$$;
revoke all on function public.get_financial_analysis(uuid,uuid) from public, anon;
grant execute on function public.get_financial_analysis(uuid,uuid) to authenticated;
