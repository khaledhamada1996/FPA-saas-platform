-- Make Financial Statements activity-aware without changing the existing RPC
-- response shape consumed by the current UI. The original implementation is
-- retained as a core function and the public RPC appends reporting metadata.

alter function public.get_financial_statements_date_range_filtered(uuid,date,date,text,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid) rename to get_financial_statements_date_range_filtered_core;

create or replace function public.get_financial_statements_date_range_filtered(p_organization_id uuid,p_start_date date,p_end_date date,p_journal_no text default null,p_cash_flow_method text default 'indirect',p_branch_id uuid default null,p_department_id uuid default null,p_cost_center_id uuid default null,p_region_id uuid default null,p_product_id uuid default null,p_project_id uuid default null,p_account_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_result jsonb; v_context jsonb;
begin
  v_result:=public.get_financial_statements_date_range_filtered_core(p_organization_id,p_start_date,p_end_date,p_journal_no,p_cash_flow_method,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_account_id);
  v_context:=public.get_financial_statement_reporting_context(p_organization_id);
  return v_result || jsonb_build_object('reporting',v_context);
end;
$$;

grant execute on function public.get_financial_statements_date_range_filtered(uuid,date,date,text,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;

-- Preserve the account-lines response shape used by the existing frontend.
alter function public.get_financial_statement_account_lines(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid) rename to get_financial_statement_account_lines_core;

create or replace function public.get_financial_statement_account_lines(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null,p_department_id uuid default null,p_cost_center_id uuid default null,p_region_id uuid default null,p_product_id uuid default null,p_project_id uuid default null,p_account_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  return public.get_financial_statement_account_lines_core(p_organization_id,p_start_date,p_end_date,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_account_id);
end;
$$;

grant execute on function public.get_financial_statement_account_lines(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;
