alter table public.accounts add column if not exists cash_flow_working_capital_role text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='accounts_cash_flow_working_capital_role_check') then
    alter table public.accounts add constraint accounts_cash_flow_working_capital_role_check check (cash_flow_working_capital_role is null or cash_flow_working_capital_role in ('operating_asset','operating_liability','non_operating'));
  end if;
end $$;

create or replace function public.get_indirect_working_capital_change(p_organization_id uuid,p_start_date date,p_end_date date,p_branch_id uuid default null,p_department_id uuid default null,p_cost_center_id uuid default null,p_region_id uuid default null,p_product_id uuid default null,p_project_id uuid default null,p_account_id uuid default null) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_user uuid:=auth.uid(); v_change bigint:=0; v_unmapped bigint:=0; v_rows jsonb:='[]'::jsonb;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=v_user) then raise exception 'Organization access required'; end if;
 if not public.has_org_permission(p_organization_id,'view') then raise exception 'Not authorized'; end if;
 if p_start_date is null or p_end_date is null or p_start_date>p_end_date then raise exception 'Invalid date range'; end if;
 with balances as (
   select a.id,a.code,a.name,a.cash_flow_working_capital_role,
     coalesce(sum(case when f.transaction_date<p_start_date then f.debit_minor-f.credit_minor else 0 end),0)::bigint opening_balance,
     coalesce(sum(case when f.transaction_date<=p_end_date then f.debit_minor-f.credit_minor else 0 end),0)::bigint closing_balance
   from public.accounts a
   left join public.financial_facts f on f.account_id=a.id and f.organization_id=p_organization_id and f.fact_type='actual' and f.status='published'
    and public.has_org_data_scope(f.organization_id,'legal_entity',f.legal_entity_id)
    and public.has_org_data_scope(f.organization_id,'branch',f.branch_id)
    and public.has_org_data_scope(f.organization_id,'department',f.department_id)
    and public.has_org_data_scope(f.organization_id,'cost_center',f.cost_center_id)
    and public.has_org_data_scope(f.organization_id,'region',f.region_id)
    and public.has_org_data_scope(f.organization_id,'product',f.product_id)
    and public.has_org_data_scope(f.organization_id,'project',f.project_id)
    and (p_branch_id is null or f.branch_id=p_branch_id)
    and (p_department_id is null or f.department_id=p_department_id)
    and (p_cost_center_id is null or f.cost_center_id=p_cost_center_id)
    and (p_region_id is null or f.region_id=p_region_id)
    and (p_product_id is null or f.product_id=p_product_id)
    and (p_project_id is null or f.project_id=p_project_id)
    and (p_account_id is null or f.account_id=p_account_id)
   where a.organization_id=p_organization_id and a.statement_subclassification in ('asset','liability') and a.cash_flow_role is distinct from 'cash'
   group by a.id,a.code,a.name,a.cash_flow_working_capital_role
 ), mapped as (select *,closing_balance-opening_balance delta from balances where cash_flow_working_capital_role in ('operating_asset','operating_liability')),
 unmapped as (select * from balances where cash_flow_working_capital_role is null and (opening_balance<>0 or closing_balance<>0))
 select coalesce((select sum(-delta) from mapped),0)::bigint,coalesce((select count(*) from unmapped),0)::bigint,
   coalesce((select jsonb_agg(jsonb_build_object('code',code,'name',name,'role',cash_flow_working_capital_role,'opening',opening_balance,'closing',closing_balance,'delta',delta) order by code) from mapped),'[]'::jsonb)
 into v_change,v_unmapped,v_rows;
 return jsonb_build_object('working_capital_change',v_change,'unmapped_operating_accounts',v_unmapped,'rows',v_rows,'basis','opening_to_closing_balance_sheet_change');
end;$function$;

revoke all on function public.get_indirect_working_capital_change(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.get_indirect_working_capital_change(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.get_financial_statements_date_range_filtered(p_organization_id uuid,p_start_date date,p_end_date date,p_journal_no text default null,p_cash_flow_method text default 'indirect',p_branch_id uuid default null,p_department_id uuid default null,p_cost_center_id uuid default null,p_region_id uuid default null,p_product_id uuid default null,p_project_id uuid default null,p_account_id uuid default null) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_result jsonb; v_accounts jsonb; v_context jsonb; v_net_income bigint; v_equity_difference bigint; v_wc jsonb; v_period_depreciation bigint;
begin
 v_result:=public.get_financial_statements_date_range_filtered_core(p_organization_id,p_start_date,p_end_date,p_journal_no,p_cash_flow_method,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_account_id);
 v_net_income:=coalesce((v_result->'balance_sheet'->>'ytd_net_income')::bigint,0);
 v_period_depreciation:=coalesce((v_result->'income_statement'->>'depreciation_amortization')::bigint,0);
 with source_rows as (select x.value row,a.id,a.parent_account_id,a.code from jsonb_array_elements(coalesce(v_result->'balance_sheet'->'accounts','[]'::jsonb)) x join public.accounts a on a.organization_id=p_organization_id and a.code=trim(x.value->>'code'))
 select coalesce(jsonb_agg(s.row||jsonb_build_object('id',s.id::text,'parent_account_id',s.parent_account_id::text) order by s.code),'[]'::jsonb) into v_accounts from source_rows s;
 v_result:=jsonb_set(v_result,'{balance_sheet,accounts}',v_accounts,true);
 with equity_facts as (select f.debit_minor,f.credit_minor,f.transaction_date,a.equity_rollforward_role from public.financial_facts f join public.accounts a on a.id=f.account_id and a.organization_id=p_organization_id where f.organization_id=p_organization_id and f.fact_type='actual' and f.status='published' and a.statement_subclassification='equity' and public.has_org_data_scope(f.organization_id,'legal_entity',f.legal_entity_id) and public.has_org_data_scope(f.organization_id,'branch',f.branch_id) and public.has_org_data_scope(f.organization_id,'department',f.department_id) and public.has_org_data_scope(f.organization_id,'cost_center',f.cost_center_id) and public.has_org_data_scope(f.organization_id,'region',f.region_id) and public.has_org_data_scope(f.organization_id,'product',f.product_id) and public.has_org_data_scope(f.organization_id,'project',f.project_id) and (p_branch_id is null or f.branch_id=p_branch_id) and (p_department_id is null or f.department_id=p_department_id) and (p_cost_center_id is null or f.cost_center_id=p_cost_center_id) and (p_region_id is null or f.region_id=p_region_id) and (p_product_id is null or f.product_id=p_product_id) and (p_project_id is null or f.project_id=p_project_id) and (p_account_id is null or f.account_id=p_account_id)), movements as (select coalesce(sum(-(debit_minor-credit_minor)) filter(where transaction_date<p_start_date),0)::bigint opening_equity,coalesce(sum(-(debit_minor-credit_minor)) filter(where transaction_date between p_start_date and p_end_date and equity_rollforward_role='capital_contribution'),0)::bigint capital_contributions,coalesce(sum(-(debit_minor-credit_minor)) filter(where transaction_date between p_start_date and p_end_date and equity_rollforward_role='owner_distribution'),0)::bigint owner_distributions,coalesce(sum(-(debit_minor-credit_minor)) filter(where transaction_date between p_start_date and p_end_date and equity_rollforward_role='retained_earnings'),0)::bigint retained_earnings,coalesce(sum(-(debit_minor-credit_minor)) filter(where transaction_date between p_start_date and p_end_date and equity_rollforward_role='other_comprehensive_income'),0)::bigint other_comprehensive_income from equity_facts)
 select coalesce((v_result->'balance_sheet'->>'total_equity')::bigint,0)-(m.opening_equity+m.capital_contributions+m.owner_distributions+m.retained_earnings+v_net_income+m.other_comprehensive_income) into v_equity_difference from movements m;
 v_result:=jsonb_set(v_result,'{validation,equity_rollforward_difference}',to_jsonb(coalesce(v_equity_difference,0)),true);
 if p_cash_flow_method='indirect' then
  v_wc:=public.get_indirect_working_capital_change(p_organization_id,p_start_date,p_end_date,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_account_id);
  v_result:=jsonb_set(v_result,'{cash_flow,operating}',jsonb_build_object('net_income',coalesce((v_result->'income_statement'->>'net_income')::bigint,0),'depreciation_amortization',v_period_depreciation,'working_capital_change',coalesce((v_wc->>'working_capital_change')::bigint,0),'net_operating_cash_flow',coalesce((v_result->'income_statement'->>'net_income')::bigint,0)+v_period_depreciation+coalesce((v_wc->>'working_capital_change')::bigint,0)),true);
  v_result:=jsonb_set(v_result,'{cash_flow,indirect_data_quality}',to_jsonb(case when coalesce((v_wc->>'unmapped_operating_accounts')::bigint,0)=0 then 'complete' else 'partial' end),true);
  v_result:=jsonb_set(v_result,'{cash_flow,indirect_unmapped_operating_accounts}',to_jsonb(coalesce((v_wc->>'unmapped_operating_accounts')::bigint,0)),true);
  v_result:=jsonb_set(v_result,'{cash_flow,indirect_working_capital_detail}',coalesce(v_wc->'rows','[]'::jsonb),true);
  v_result:=jsonb_set(v_result,'{cash_flow,reconciliation_difference}',to_jsonb(coalesce((v_result->'cash_flow'->>'closing_cash')::bigint,0)-coalesce((v_result->'cash_flow'->>'opening_cash')::bigint,0)-(coalesce((v_result->'cash_flow'->'operating'->>'net_operating_cash_flow')::bigint,0)+coalesce((v_result->'cash_flow'->'investing'->>'net_cash_flow')::bigint,0)+coalesce((v_result->'cash_flow'->'financing'->>'net_cash_flow')::bigint,0))),true);
  v_result:=jsonb_set(v_result,'{validation,indirect_cash_flow_reconciliation_difference}',v_result->'cash_flow'->'reconciliation_difference',true);
 end if;
 v_context:=public.get_financial_statement_reporting_context(p_organization_id); return v_result||jsonb_build_object('reporting',v_context);
end;$function$;
revoke all on function public.get_financial_statements_date_range_filtered(uuid,date,date,text,text,uuid,uuid,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.get_financial_statements_date_range_filtered(uuid,date,date,text,text,uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;
