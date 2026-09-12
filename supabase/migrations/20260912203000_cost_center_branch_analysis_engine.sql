create or replace function public.get_dimension_analysis(p_organization_id uuid, p_period_id uuid, p_dimension text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_period record;
  v_dimension text := lower(trim(coalesce(p_dimension,'')));
  v_rows jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_organization_id is null or p_period_id is null then raise exception 'Organization and period are required'; end if;
  if not public.has_org_permission(p_organization_id,'view') then raise exception 'Not authorized'; end if;
  select id, organization_id, period_start, period_end, status into v_period
  from public.financial_periods where id=p_period_id and organization_id=p_organization_id;
  if v_period.id is null then raise exception 'Financial period not found'; end if;
  if v_dimension not in ('branch','cost_center') then raise exception 'Unsupported dimension'; end if;
  if v_dimension='branch' then
    select coalesce(jsonb_agg(x order by x.revenue desc),'[]'::jsonb) into v_rows from (
      select coalesce(b.name,'غير محدد') dimension_name,b.id dimension_id,
      coalesce(sum(case when lower(coalesce(a.account_type,'')) in ('revenue','income') then ff.credit_minor-ff.debit_minor else 0 end),0)::bigint revenue,
      coalesce(sum(case when lower(coalesce(a.account_type,'')) in ('cost_of_sales','cogs') then ff.debit_minor-ff.credit_minor else 0 end),0)::bigint cogs,
      coalesce(sum(case when lower(coalesce(a.account_type,'')) in ('expense','operating_expense','operating_expenses') then ff.debit_minor-ff.credit_minor else 0 end),0)::bigint operating_expenses
      from public.financial_facts ff join public.accounts a on a.id=ff.account_id and a.organization_id=p_organization_id left join public.branches b on b.id=ff.branch_id and b.organization_id=p_organization_id
      where ff.organization_id=p_organization_id and ff.financial_period_id=p_period_id and ff.fact_type='actual'
      and public.has_org_data_scope(ff.organization_id,'legal_entity',ff.legal_entity_id) and public.has_org_data_scope(ff.organization_id,'branch',ff.branch_id) and public.has_org_data_scope(ff.organization_id,'department',ff.department_id) and public.has_org_data_scope(ff.organization_id,'cost_center',ff.cost_center_id) and public.has_org_data_scope(ff.organization_id,'region',ff.region_id) and public.has_org_data_scope(ff.organization_id,'product',ff.product_id) and public.has_org_data_scope(ff.organization_id,'project',ff.project_id)
      group by b.id,b.name) x;
  else
    select coalesce(jsonb_agg(x order by x.revenue desc),'[]'::jsonb) into v_rows from (
      select coalesce(cc.name,'غير محدد') dimension_name,cc.id dimension_id,
      coalesce(sum(case when lower(coalesce(a.account_type,'')) in ('revenue','income') then ff.credit_minor-ff.debit_minor else 0 end),0)::bigint revenue,
      coalesce(sum(case when lower(coalesce(a.account_type,'')) in ('cost_of_sales','cogs') then ff.debit_minor-ff.credit_minor else 0 end),0)::bigint cogs,
      coalesce(sum(case when lower(coalesce(a.account_type,'')) in ('expense','operating_expense','operating_expenses') then ff.debit_minor-ff.credit_minor else 0 end),0)::bigint operating_expenses
      from public.financial_facts ff join public.accounts a on a.id=ff.account_id and a.organization_id=p_organization_id left join public.cost_centers cc on cc.id=ff.cost_center_id and cc.organization_id=p_organization_id
      where ff.organization_id=p_organization_id and ff.financial_period_id=p_period_id and ff.fact_type='actual'
      and public.has_org_data_scope(ff.organization_id,'legal_entity',ff.legal_entity_id) and public.has_org_data_scope(ff.organization_id,'branch',ff.branch_id) and public.has_org_data_scope(ff.organization_id,'department',ff.department_id) and public.has_org_data_scope(ff.organization_id,'cost_center',ff.cost_center_id) and public.has_org_data_scope(ff.organization_id,'region',ff.region_id) and public.has_org_data_scope(ff.organization_id,'product',ff.product_id) and public.has_org_data_scope(ff.organization_id,'project',ff.project_id)
      group by cc.id,cc.name) x;
  end if;
  return jsonb_build_object('organization_id',p_organization_id,'period',jsonb_build_object('id',v_period.id,'start',v_period.period_start,'end',v_period.period_end,'status',v_period.status),'dimension',v_dimension,'rows',v_rows,'methodology',jsonb_build_object('source','published actual financial facts','ai_authoritative',false));
end;
$$;
revoke all on function public.get_dimension_analysis(uuid,uuid,text) from public;
revoke all on function public.get_dimension_analysis(uuid,uuid,text) from anon;
grant execute on function public.get_dimension_analysis(uuid,uuid,text) to authenticated;
