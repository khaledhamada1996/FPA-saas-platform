create or replace function public.get_trial_balance(
  p_organization_id uuid,
  p_period_id uuid,
  p_branch_id uuid default null,
  p_department_id uuid default null,
  p_cost_center_id uuid default null,
  p_region_id uuid default null,
  p_product_id uuid default null,
  p_project_id uuid default null,
  p_account_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_period record;
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

  select fp.id, fp.organization_id, fp.period_start, fp.period_end, fp.status
    into v_period
  from public.financial_periods fp
  where fp.id = p_period_id
    and fp.organization_id = p_organization_id;

  if v_period.id is null then raise exception 'Financial period not found'; end if;

  with scoped_facts as (
    select ff.account_id,ff.financial_period_id,ff.transaction_date,
      coalesce(ff.debit_minor,0)::bigint debit_minor,
      coalesce(ff.credit_minor,0)::bigint credit_minor
    from public.financial_facts ff
    where ff.organization_id=p_organization_id and ff.fact_type='actual' and ff.status='published'
      and public.has_org_data_scope(ff.organization_id,'legal_entity',ff.legal_entity_id)
      and public.has_org_data_scope(ff.organization_id,'branch',ff.branch_id)
      and public.has_org_data_scope(ff.organization_id,'department',ff.department_id)
      and public.has_org_data_scope(ff.organization_id,'cost_center',ff.cost_center_id)
      and public.has_org_data_scope(ff.organization_id,'region',ff.region_id)
      and public.has_org_data_scope(ff.organization_id,'product',ff.product_id)
      and public.has_org_data_scope(ff.organization_id,'project',ff.project_id)
      and (p_branch_id is null or ff.branch_id=p_branch_id)
      and (p_department_id is null or ff.department_id=p_department_id)
      and (p_cost_center_id is null or ff.cost_center_id=p_cost_center_id)
      and (p_region_id is null or ff.region_id=p_region_id)
      and (p_product_id is null or ff.product_id=p_product_id)
      and (p_project_id is null or ff.project_id=p_project_id)
      and (p_account_id is null or ff.account_id=p_account_id)
  ),
  opening_baseline as (
    select ob.account_id,coalesce(sum(ob.debit_minor),0)::bigint debit_minor,
      coalesce(sum(ob.credit_minor),0)::bigint credit_minor
    from public.opening_balances ob
    join public.accounts oa on oa.id=ob.account_id and oa.organization_id=ob.organization_id
    where ob.organization_id=p_organization_id and ob.status='approved'
      and ob.opening_date<=v_period.period_start
      and (p_branch_id is null or ob.branch_id=p_branch_id)
      and (p_department_id is null or ob.department_id=p_department_id)
      and (p_cost_center_id is null or ob.cost_center_id=p_cost_center_id)
      and (p_region_id is null or ob.region_id=p_region_id)
      and (p_product_id is null or ob.product_id=p_product_id)
      and (p_project_id is null or ob.project_id=p_project_id)
      and (p_account_id is null or ob.account_id=p_account_id)
    group by ob.account_id
  ),
  prior_balance_sheet as (
    select sf.account_id,coalesce(sum(sf.debit_minor),0)::bigint debit_minor,
      coalesce(sum(sf.credit_minor),0)::bigint credit_minor
    from scoped_facts sf
    join public.accounts pa on pa.id=sf.account_id and pa.organization_id=p_organization_id
    where sf.transaction_date<v_period.period_start
      and lower(coalesce(pa.statement_type,''))='balance_sheet'
    group by sf.account_id
  ),
  account_period as (
    select a.id account_id,a.code,a.name,a.account_type,a.statement_type,a.statement_section,a.statement_subclassification,
      (coalesce(ob.debit_minor,0)-coalesce(ob.credit_minor,0)
       +coalesce(pb.debit_minor,0)-coalesce(pb.credit_minor,0))::bigint opening_balance,
      coalesce(sum(case when sf.financial_period_id=p_period_id then sf.debit_minor else 0 end),0)::bigint period_debit,
      coalesce(sum(case when sf.financial_period_id=p_period_id then sf.credit_minor else 0 end),0)::bigint period_credit
    from public.accounts a
    left join scoped_facts sf on sf.account_id=a.id
    left join opening_baseline ob on ob.account_id=a.id
    left join prior_balance_sheet pb on pb.account_id=a.id
    where a.organization_id=p_organization_id and (p_account_id is null or a.id=p_account_id)
    group by a.id,a.code,a.name,a.account_type,a.statement_type,a.statement_section,a.statement_subclassification,
      ob.debit_minor,ob.credit_minor,pb.debit_minor,pb.credit_minor
  ),
  normalized as (
    select *, (opening_balance+period_debit-period_credit)::bigint closing_balance
    from account_period
    where opening_balance<>0 or period_debit<>0 or period_credit<>0
  ),
  final_rows as (
    select account_id,code,name,account_type,statement_type,statement_section,statement_subclassification,
      case when opening_balance>0 then opening_balance else 0 end::bigint opening_debit,
      case when opening_balance<0 then -opening_balance else 0 end::bigint opening_credit,
      period_debit,period_credit,
      case when closing_balance>0 then closing_balance else 0 end::bigint closing_debit,
      case when closing_balance<0 then -closing_balance else 0 end::bigint closing_credit
    from normalized
  )
  select count(*),coalesce(sum(period_debit),0),coalesce(sum(period_credit),0),coalesce(sum(opening_debit),0),coalesce(sum(opening_credit),0),coalesce(sum(closing_debit),0),coalesce(sum(closing_credit),0),coalesce(jsonb_agg(to_jsonb(final_rows) order by code),'[]'::jsonb)
  into v_row_count,v_total_debit,v_total_credit,v_total_opening_debit,v_total_opening_credit,v_total_closing_debit,v_total_closing_credit,v_rows
  from final_rows;

  return jsonb_build_object('organization_id',p_organization_id,'period_id',v_period.id,'period_start',v_period.period_start,'period_end',v_period.period_end,'period_status',v_period.status,'row_count',v_row_count,'total_period_debit',v_total_debit,'total_period_credit',v_total_credit,'period_difference',v_total_debit-v_total_credit,'total_opening_debit',v_total_opening_debit,'total_opening_credit',v_total_opening_credit,'opening_difference',v_total_opening_debit-v_total_opening_credit,'total_closing_debit',v_total_closing_debit,'total_closing_credit',v_total_closing_credit,'closing_difference',v_total_closing_debit-v_total_closing_credit,'rows',v_rows);
end;
$function$;

create or replace function public.get_trial_balance_date_range_filtered(
  p_organization_id uuid,p_start_date date,p_end_date date,
  p_branch_id uuid default null,p_department_id uuid default null,p_cost_center_id uuid default null,
  p_region_id uuid default null,p_product_id uuid default null,p_project_id uuid default null,p_account_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid:=auth.uid(); v_fiscal_month smallint; v_fiscal_year_start date;
  v_row_count integer; v_total_debit bigint; v_total_credit bigint;
  v_total_opening_debit bigint; v_total_opening_credit bigint;
  v_total_closing_debit bigint; v_total_closing_credit bigint; v_rows jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_organization_id is null or p_start_date is null or p_end_date is null or p_start_date>p_end_date then raise exception 'Organization and valid date range are required'; end if;
  if not public.has_org_permission(p_organization_id,'view') then raise exception 'Not authorized'; end if;
  select greatest(1,least(12,o.fiscal_year_start_month)) into v_fiscal_month from public.organizations o where o.id=p_organization_id;
  if v_fiscal_month is null then raise exception 'Organization not found'; end if;
  v_fiscal_year_start:=make_date(extract(year from p_start_date)::integer-case when extract(month from p_start_date)::integer<v_fiscal_month then 1 else 0 end,v_fiscal_month,1);

  with scoped_facts as (
    select ff.account_id,ff.transaction_date,coalesce(ff.debit_minor,0)::bigint debit_minor,coalesce(ff.credit_minor,0)::bigint credit_minor
    from public.financial_facts ff
    where ff.organization_id=p_organization_id and ff.fact_type='actual' and ff.status='published'
      and public.has_org_data_scope(ff.organization_id,'legal_entity',ff.legal_entity_id)
      and public.has_org_data_scope(ff.organization_id,'branch',ff.branch_id)
      and public.has_org_data_scope(ff.organization_id,'department',ff.department_id)
      and public.has_org_data_scope(ff.organization_id,'cost_center',ff.cost_center_id)
      and public.has_org_data_scope(ff.organization_id,'region',ff.region_id)
      and public.has_org_data_scope(ff.organization_id,'product',ff.product_id)
      and public.has_org_data_scope(ff.organization_id,'project',ff.project_id)
      and (p_branch_id is null or ff.branch_id=p_branch_id)
      and (p_department_id is null or ff.department_id=p_department_id)
      and (p_cost_center_id is null or ff.cost_center_id=p_cost_center_id)
      and (p_region_id is null or ff.region_id=p_region_id)
      and (p_product_id is null or ff.product_id=p_product_id)
      and (p_project_id is null or ff.project_id=p_project_id)
      and (p_account_id is null or ff.account_id=p_account_id)
  ),
  opening_baseline as (
    select ob.account_id,coalesce(sum(ob.debit_minor),0)::bigint debit_minor,coalesce(sum(ob.credit_minor),0)::bigint credit_minor
    from public.opening_balances ob
    join public.accounts oa on oa.id=ob.account_id and oa.organization_id=ob.organization_id
    where ob.organization_id=p_organization_id and ob.status='approved' and ob.opening_date<=p_start_date
      and (p_branch_id is null or ob.branch_id=p_branch_id)
      and (p_department_id is null or ob.department_id=p_department_id)
      and (p_cost_center_id is null or ob.cost_center_id=p_cost_center_id)
      and (p_region_id is null or ob.region_id=p_region_id)
      and (p_product_id is null or ob.product_id=p_product_id)
      and (p_project_id is null or ob.project_id=p_project_id)
      and (p_account_id is null or ob.account_id=p_account_id)
    group by ob.account_id
  ),
  account_period as (
    select a.id account_id,a.code,a.name,a.account_type,a.statement_type,a.statement_section,a.statement_subclassification,
      case when lower(coalesce(a.statement_type,''))='balance_sheet' then
        coalesce(ob.debit_minor,0)-coalesce(ob.credit_minor,0)+coalesce((select sum(sf2.debit_minor-sf2.credit_minor) from scoped_facts sf2 where sf2.account_id=a.id and sf2.transaction_date<p_start_date),0)
      else
        coalesce((select sum(sf2.debit_minor-sf2.credit_minor) from scoped_facts sf2 where sf2.account_id=a.id and sf2.transaction_date<p_start_date and sf2.transaction_date>=v_fiscal_year_start),0)
      end::bigint opening_balance,
      coalesce(sum(case when sf.transaction_date between p_start_date and p_end_date then sf.debit_minor else 0 end),0)::bigint period_debit,
      coalesce(sum(case when sf.transaction_date between p_start_date and p_end_date then sf.credit_minor else 0 end),0)::bigint period_credit
    from public.accounts a
    left join scoped_facts sf on sf.account_id=a.id
    left join opening_baseline ob on ob.account_id=a.id
    where a.organization_id=p_organization_id and (p_account_id is null or a.id=p_account_id)
    group by a.id,a.code,a.name,a.account_type,a.statement_type,a.statement_section,a.statement_subclassification,ob.debit_minor,ob.credit_minor
  ),
  normalized as (
    select *, (opening_balance+period_debit-period_credit)::bigint closing_balance from account_period
    where opening_balance<>0 or period_debit<>0 or period_credit<>0
  ),
  final_rows as (
    select account_id,code,name,account_type,statement_type,statement_section,statement_subclassification,
      case when opening_balance>0 then opening_balance else 0 end::bigint opening_debit,
      case when opening_balance<0 then -opening_balance else 0 end::bigint opening_credit,
      period_debit,period_credit,
      case when closing_balance>0 then closing_balance else 0 end::bigint closing_debit,
      case when closing_balance<0 then -closing_balance else 0 end::bigint closing_credit
    from normalized
  )
  select count(*),coalesce(sum(period_debit),0),coalesce(sum(period_credit),0),coalesce(sum(opening_debit),0),coalesce(sum(opening_credit),0),coalesce(sum(closing_debit),0),coalesce(sum(closing_credit),0),coalesce(jsonb_agg(to_jsonb(final_rows) order by code),'[]'::jsonb)
  into v_row_count,v_total_debit,v_total_credit,v_total_opening_debit,v_total_opening_credit,v_total_closing_debit,v_total_closing_credit,v_rows from final_rows;

  return jsonb_build_object('organization_id',p_organization_id,'period_start',p_start_date,'period_end',p_end_date,'fiscal_year_start',v_fiscal_year_start,'row_count',v_row_count,'total_period_debit',v_total_debit,'total_period_credit',v_total_credit,'period_difference',v_total_debit-v_total_credit,'total_opening_debit',v_total_opening_debit,'total_opening_credit',v_total_opening_credit,'opening_difference',v_total_opening_debit-v_total_opening_credit,'total_closing_debit',v_total_closing_debit,'total_closing_credit',v_total_closing_credit,'closing_difference',v_total_closing_debit-v_total_closing_credit,'rows',v_rows);
end;
$function$;
