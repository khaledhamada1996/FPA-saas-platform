create or replace function public.get_dynamic_reporting_filter_options(
  p_organization_id uuid,
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
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_organization_id is null then raise exception 'Organization is required'; end if;
  if not (
    public.has_org_permission(p_organization_id,'screen.financial_statements.view')
    or public.has_org_permission(p_organization_id,'screen.financial_analysis.view')
    or public.has_org_permission(p_organization_id,'screen.variance.view')
    or public.has_org_permission(p_organization_id,'view')
  ) then raise exception 'Reporting filter permission required'; end if;
  with scoped as (
    select distinct ff.branch_id,ff.department_id,ff.cost_center_id,ff.region_id,ff.product_id,ff.project_id,ff.account_id
    from public.financial_facts ff
    where ff.organization_id=p_organization_id and ff.fact_type='actual' and ff.status='published'
      and public.has_org_data_scope(ff.organization_id,'legal_entity',ff.legal_entity_id)
      and public.has_org_data_scope(ff.organization_id,'branch',ff.branch_id)
      and public.has_org_data_scope(ff.organization_id,'department',ff.department_id)
      and public.has_org_data_scope(ff.organization_id,'cost_center',ff.cost_center_id)
      and public.has_org_data_scope(ff.organization_id,'region',ff.region_id)
      and public.has_org_data_scope(ff.organization_id,'product',ff.product_id)
      and public.has_org_data_scope(ff.organization_id,'project',ff.project_id)
  ),
  branch_options as (select distinct branch_id id from scoped where branch_id is not null and (p_department_id is null or department_id=p_department_id) and (p_cost_center_id is null or cost_center_id=p_cost_center_id) and (p_region_id is null or region_id=p_region_id) and (p_product_id is null or product_id=p_product_id) and (p_project_id is null or project_id=p_project_id) and (p_account_id is null or account_id=p_account_id)),
  department_options as (select distinct department_id id from scoped where department_id is not null and (p_branch_id is null or branch_id=p_branch_id) and (p_cost_center_id is null or cost_center_id=p_cost_center_id) and (p_region_id is null or region_id=p_region_id) and (p_product_id is null or product_id=p_product_id) and (p_project_id is null or project_id=p_project_id) and (p_account_id is null or account_id=p_account_id)),
  cost_center_options as (select distinct cost_center_id id from scoped where cost_center_id is not null and (p_branch_id is null or branch_id=p_branch_id) and (p_department_id is null or department_id=p_department_id) and (p_region_id is null or region_id=p_region_id) and (p_product_id is null or product_id=p_product_id) and (p_project_id is null or project_id=p_project_id) and (p_account_id is null or account_id=p_account_id)),
  region_options as (select distinct region_id id from scoped where region_id is not null and (p_branch_id is null or branch_id=p_branch_id) and (p_department_id is null or department_id=p_department_id) and (p_cost_center_id is null or cost_center_id=p_cost_center_id) and (p_product_id is null or product_id=p_product_id) and (p_project_id is null or project_id=p_project_id) and (p_account_id is null or account_id=p_account_id)),
  product_options as (select distinct product_id id from scoped where product_id is not null and (p_branch_id is null or branch_id=p_branch_id) and (p_department_id is null or department_id=p_department_id) and (p_cost_center_id is null or cost_center_id=p_cost_center_id) and (p_region_id is null or region_id=p_region_id) and (p_project_id is null or project_id=p_project_id) and (p_account_id is null or account_id=p_account_id)),
  project_options as (select distinct project_id id from scoped where project_id is not null and (p_branch_id is null or branch_id=p_branch_id) and (p_department_id is null or department_id=p_department_id) and (p_cost_center_id is null or cost_center_id=p_cost_center_id) and (p_region_id is null or region_id=p_region_id) and (p_product_id is null or product_id=p_product_id) and (p_account_id is null or account_id=p_account_id)),
  account_options as (select distinct account_id id from scoped where account_id is not null and (p_branch_id is null or branch_id=p_branch_id) and (p_department_id is null or department_id=p_department_id) and (p_cost_center_id is null or cost_center_id=p_cost_center_id) and (p_region_id is null or region_id=p_region_id) and (p_product_id is null or product_id=p_product_id) and (p_project_id is null or project_id=p_project_id))
  select jsonb_build_object(
    'branches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'code',b.code,'name',b.name) order by b.code,b.name) from public.branches b join branch_options o on o.id=b.id where b.organization_id=p_organization_id and b.is_active),'[]'::jsonb),
    'departments',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'name',d.name) order by d.code,d.name) from public.departments d join department_options o on o.id=d.id where d.organization_id=p_organization_id),'[]'::jsonb),
    'cost_centers',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name) order by c.code,c.name) from public.cost_centers c join cost_center_options o on o.id=c.id where c.organization_id=p_organization_id),'[]'::jsonb),
    'regions',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'name',r.name) order by r.code,r.name) from public.regions r join region_options o on o.id=r.id where r.organization_id=p_organization_id),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name) order by p.code,p.name) from public.products p join product_options o on o.id=p.id where p.organization_id=p_organization_id),'[]'::jsonb),
    'projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name) order by p.code,p.name) from public.projects p join project_options o on o.id=p.id where p.organization_id=p_organization_id),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'code',a.code,'name',a.name,'type',a.account_type,'statement_type',a.statement_type,'subclassification',a.statement_subclassification) order by a.code) from public.accounts a join account_options o on o.id=a.id where a.organization_id=p_organization_id),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;