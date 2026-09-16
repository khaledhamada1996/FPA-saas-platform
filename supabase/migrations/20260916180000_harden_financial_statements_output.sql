CREATE OR REPLACE FUNCTION public.get_financial_statements_date_range_filtered(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_journal_no text DEFAULT NULL::text,
  p_cash_flow_method text DEFAULT 'indirect'::text,
  p_branch_id uuid DEFAULT NULL::uuid,
  p_department_id uuid DEFAULT NULL::uuid,
  p_cost_center_id uuid DEFAULT NULL::uuid,
  p_region_id uuid DEFAULT NULL::uuid,
  p_product_id uuid DEFAULT NULL::uuid,
  p_project_id uuid DEFAULT NULL::uuid,
  p_account_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_result jsonb;
  v_accounts jsonb;
  v_context jsonb;
  v_net_income bigint;
  v_equity_difference bigint;
begin
  v_result := public.get_financial_statements_date_range_filtered_core(
    p_organization_id,p_start_date,p_end_date,p_journal_no,p_cash_flow_method,
    p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_account_id
  );

  v_net_income := coalesce((v_result->'balance_sheet'->>'ytd_net_income')::bigint,0);

  with source_rows as (
    select x.value as row, a.id, a.parent_account_id, a.code
    from jsonb_array_elements(coalesce(v_result->'balance_sheet'->'accounts','[]'::jsonb)) x
    join public.accounts a
      on a.organization_id=p_organization_id
     and a.code=trim(x.value->>'code')
  )
  select coalesce(
    jsonb_agg(
      s.row || jsonb_build_object(
        'id',s.id::text,
        'parent_account_id',s.parent_account_id::text
      ) order by s.code
    ),'[]'::jsonb
  ) into v_accounts
  from source_rows s;

  v_result := jsonb_set(v_result,'{balance_sheet,accounts}',v_accounts,true);

  with equity_facts as (
    select
      f.debit_minor,
      f.credit_minor,
      f.transaction_date,
      a.equity_rollforward_role
    from public.financial_facts f
    join public.accounts a
      on a.id=f.account_id
     and a.organization_id=p_organization_id
    where f.organization_id=p_organization_id
      and f.fact_type='actual'
      and f.status='published'
      and a.statement_subclassification='equity'
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
  ), movements as (
    select
      coalesce(sum(-(debit_minor-credit_minor)) filter(where transaction_date < p_start_date),0)::bigint opening_equity,
      coalesce(sum(-(debit_minor-credit_minor)) filter(where transaction_date between p_start_date and p_end_date and equity_rollforward_role='capital_contribution'),0)::bigint capital_contributions,
      coalesce(sum(-(debit_minor-credit_minor)) filter(where transaction_date between p_start_date and p_end_date and equity_rollforward_role='owner_distribution'),0)::bigint owner_distributions,
      coalesce(sum(-(debit_minor-credit_minor)) filter(where transaction_date between p_start_date and p_end_date and equity_rollforward_role='retained_earnings'),0)::bigint retained_earnings,
      coalesce(sum(-(debit_minor-credit_minor)) filter(where transaction_date between p_start_date and p_end_date and equity_rollforward_role='other_comprehensive_income'),0)::bigint other_comprehensive_income
    from equity_facts
  )
  select
    coalesce((v_result->'balance_sheet'->>'total_equity')::bigint,0)
      - (m.opening_equity + m.capital_contributions + m.owner_distributions + m.retained_earnings + v_net_income + m.other_comprehensive_income)
  into v_equity_difference
  from movements m;

  v_result := jsonb_set(v_result,'{validation,equity_rollforward_difference}',to_jsonb(coalesce(v_equity_difference,0)),true);

  v_context := public.get_financial_statement_reporting_context(p_organization_id);
  return v_result || jsonb_build_object('reporting',v_context);
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_financial_statements_date_range_filtered(uuid,date,date,text,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_statements_date_range_filtered(uuid,date,date,text,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid) TO authenticated;
