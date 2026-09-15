create or replace function public.get_financial_statement_account_lines(
  p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null,p_department_id uuid default null,p_cost_center_id uuid default null,p_region_id uuid default null,p_product_id uuid default null,p_project_id uuid default null,p_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_raw jsonb; v_statement jsonb; v_result jsonb; v_net_income bigint;
begin
  v_raw := public.get_financial_statement_account_lines_core(p_organization_id,p_start_date,p_end_date,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_account_id);
  v_statement := public.get_financial_statements_date_range_filtered_core(p_organization_id,p_start_date,p_end_date,null,'indirect',p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_account_id);
  v_net_income := coalesce((v_statement->'balance_sheet'->>'ytd_net_income')::bigint,0);
  with recursive source as (
    select x.value row,(x.value->>'id')::uuid id,nullif(x.value->>'parent_account_id','')::uuid parent_account_id,a.account_type,a.equity_rollforward_role
    from jsonb_array_elements(coalesce(v_raw,'[]'::jsonb)) x join public.accounts a on a.id=(x.value->>'id')::uuid and a.organization_id=p_organization_id
  ),
  profit as (select id from source where equity_rollforward_role='current_year_profit' limit 1),
  profit_ancestors as (select id from profit union all select s.id from source s join profit_ancestors p on p.id=s.parent_account_id),
  shaped as (
    select row,
      case when account_type='asset' then coalesce((row->>'own_balance')::bigint,0) when account_type in ('liability','equity') then -(coalesce((row->>'own_balance')::bigint,0)+case when exists(select 1 from profit_ancestors p where p.id=source.id) then v_net_income else 0 end) else coalesce((row->>'own_balance')::bigint,0) end own_display,
      case when account_type='asset' then coalesce((row->>'balance')::bigint,0) when account_type in ('liability','equity') then -(coalesce((row->>'balance')::bigint,0)+case when exists(select 1 from profit_ancestors p where p.id=source.id) then v_net_income else 0 end) else coalesce((row->>'balance')::bigint,0) end display_balance
    from source
  )
  select coalesce(jsonb_agg(row || jsonb_build_object('own_balance',own_display,'balance',display_balance,'raw_own_balance',coalesce((row->>'own_balance')::bigint,0),'raw_balance',coalesce((row->>'balance')::bigint,0)) order by (row->>'depth')::int,row->>'code'),'[]'::jsonb) into v_result from shaped;
  return v_result;
end;
$function$;
