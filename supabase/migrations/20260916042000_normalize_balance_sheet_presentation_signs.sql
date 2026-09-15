create or replace function public.get_financial_statements_date_range_filtered(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_journal_no text default null,
  p_cash_flow_method text default 'indirect',
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
as $function$
declare
  v_result jsonb;
  v_context jsonb;
  v_accounts jsonb;
  v_net_income bigint;
begin
  v_result := public.get_financial_statements_date_range_filtered_core(p_organization_id,p_start_date,p_end_date,p_journal_no,p_cash_flow_method,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_account_id);
  v_net_income := coalesce((v_result->'balance_sheet'->>'ytd_net_income')::bigint,0);
  with recursive source_rows as (
    select x.value as row,a.id,a.parent_account_id,a.code,a.name,a.account_type,a.is_contra,a.equity_rollforward_role
    from jsonb_array_elements(coalesce(v_result->'balance_sheet'->'accounts','[]'::jsonb)) x
    join public.accounts a on a.organization_id=p_organization_id and a.id=(x.value->>'id')::uuid
  ),
  profit_account as (select id from source_rows where equity_rollforward_role='current_year_profit' limit 1),
  profit_ancestors as (select id from profit_account union all select p.id from source_rows p join profit_ancestors c on c.id=p.parent_account_id),
  shaped as (
    select s.*,exists(select 1 from source_rows c where c.parent_account_id=s.id) has_children,
      case when s.account_type='asset' then coalesce((s.row->>'balance')::bigint,0)
           when s.account_type in ('liability','equity') then -(coalesce((s.row->>'balance')::bigint,0)+case when s.account_type='equity' and exists(select 1 from profit_ancestors pa where pa.id=s.id) then v_net_income else 0 end)
           else coalesce((s.row->>'balance')::bigint,0) end display_balance
    from source_rows s
  )
  select coalesce(jsonb_agg(s.row || jsonb_build_object('id',s.id::text,'parent_account_id',s.parent_account_id::text,'balance',s.display_balance,'raw_balance',coalesce((s.row->>'balance')::bigint,0),'depth',0,'has_children',s.has_children) order by s.code),'[]'::jsonb) into v_accounts from shaped s;
  v_result := jsonb_set(v_result,'{balance_sheet,accounts}',v_accounts,true);
  v_context := public.get_financial_statement_reporting_context(p_organization_id);
  return v_result || jsonb_build_object('reporting',v_context);
end;
$function$;
