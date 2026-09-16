-- Account-level statement filtering returns a scoped subset, so full-statement
-- balance-sheet/equity/cash-flow reconciliations are not mathematically applicable.
-- Keep the scoped report values, but prevent the validation panel from reporting
-- false reconciliation errors for a single-account slice.

do $do$
declare
  src text;
  marker text := $marker$  v_result:=jsonb_set(v_result,'{validation,indirect_cash_flow_reconciliation_difference}',v_result->'cash_flow'->'reconciliation_difference',true);
  v_context:=public.get_financial_statement_reporting_context(p_organization_id); return v_result || jsonb_build_object('reporting',v_context);$marker$;
  replacement text := $replacement$  v_result:=jsonb_set(v_result,'{validation,indirect_cash_flow_reconciliation_difference}',v_result->'cash_flow'->'reconciliation_difference',true);
  if p_account_id is not null then
    v_result:=jsonb_set(v_result,'{validation}',jsonb_build_object(
      'balance_sheet_difference',null,
      'unclassified_income_accounts',v_result->'validation'->'unclassified_income_accounts',
      'equity_rollforward_difference',null,
      'cash_flow_reconciliation_difference',null,
      'indirect_cash_flow_reconciliation_difference',null,
      'scope','account'
    ),true);
    v_result:=jsonb_set(v_result,'{cash_flow,reconciliation_difference}','null'::jsonb,true);
    v_result:=jsonb_set(v_result,'{cash_flow,indirect_data_quality}',to_jsonb('not_applicable'::text),true);
  end if;
  v_context:=public.get_financial_statement_reporting_context(p_organization_id); return v_result || jsonb_build_object('reporting',v_context);$replacement$;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='get_financial_statements_date_range_filtered'
    and pg_get_function_identity_arguments(p.oid)='p_organization_id uuid, p_start_date date, p_end_date date, p_journal_no text, p_cash_flow_method text, p_branch_id uuid, p_department_id uuid, p_cost_center_id uuid, p_region_id uuid, p_product_id uuid, p_project_id uuid, p_account_id uuid';

  if src is null then
    raise exception 'Financial statements function not found';
  end if;
  if position(marker in src)=0 then
    raise exception 'Expected validation return marker not found';
  end if;
  src:=replace(src,marker,replacement);
  execute src;
end $do$;
