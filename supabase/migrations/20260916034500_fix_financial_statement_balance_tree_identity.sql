create or replace function public.get_financial_statements_date_range_filtered(p_organization_id uuid,p_start_date date,p_end_date date,p_journal_no text default null,p_cash_flow_method text default 'indirect',p_branch_id uuid default null,p_department_id uuid default null,p_cost_center_id uuid default null,p_region_id uuid default null,p_product_id uuid default null,p_project_id uuid default null,p_account_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_result jsonb; v_context jsonb; v_accounts jsonb;
begin
 v_result:=public.get_financial_statements_date_range_filtered_core(p_organization_id,p_start_date,p_end_date,p_journal_no,p_cash_flow_method,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_account_id);
 select coalesce(jsonb_agg(jsonb_set(x.value,'{id}',to_jsonb(a.id::text),true) order by (x.value->>'code')),'[]'::jsonb) into v_accounts
 from jsonb_array_elements(coalesce(v_result->'balance_sheet'->'accounts','[]'::jsonb)) x
 left join public.accounts a on a.organization_id=p_organization_id and a.code=x.value->>'code';
 v_result:=jsonb_set(v_result,'{balance_sheet,accounts}',v_accounts,true);
 v_context:=public.get_financial_statement_reporting_context(p_organization_id);
 return v_result || jsonb_build_object('reporting',v_context);
end;
$function$;
