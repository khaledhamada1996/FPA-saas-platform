do $outer$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_financial_statement_account_lines' and p.pronargs=10;
  if v_def is null then raise exception 'target function not found'; end if;

  v_new := replace(v_def,
    $$v_statement jsonb;
  v_result jsonb;$$,
    $$v_statement jsonb;
  v_tb jsonb;
  v_result jsonb;$$
  );
  v_new := replace(v_new,
    $$v_statement := public.get_financial_statements_date_range_filtered_core(p_organization_id,p_start_date,p_end_date,null,'indirect',p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_account_id);$$,
    $$v_statement := public.get_financial_statements_date_range_filtered_core(p_organization_id,p_start_date,p_end_date,null,'indirect',p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_account_id);
  v_tb := public.get_trial_balance_date_range_filtered(p_organization_id,p_start_date,p_end_date,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_account_id);$$
  );
  v_new := replace(v_new,
    $$with recursive source as (
    select case when x.value->>'statement_type'='balance_sheet' then x.value || coalesce((select jsonb_build_object('opening',s.value->'opening','period',s.value->'period','balance',s.value->'balance') from jsonb_array_elements(coalesce(v_statement->'balance_sheet'->'accounts','[]'::jsonb)) s where s.value->>'code'=x.value->>'code' limit 1),'{}'::jsonb) else x.value end row,(x.value->>'id')::uuid id,nullif(x.value->>'parent_account_id','')::uuid parent_account_id,a.account_type,a.equity_rollforward_role
    from jsonb_array_elements(coalesce(v_raw,'[]'::jsonb)) x join public.accounts a on a.id=(x.value->>'id')::uuid and a.organization_id=p_organization_id
  ),$$,
    $$with recursive nodes as (
    select a.id,a.parent_account_id,a.account_type,a.equity_rollforward_role
    from public.accounts a
    where a.organization_id=p_organization_id and lower(coalesce(a.statement_type,''))='balance_sheet'
      and a.statement_subclassification in ('asset','liability','equity')
  ), descendants as (
    select n.id root_id,n.id descendant_id from nodes n
    union all
    select d.root_id,n.id from descendants d join nodes n on n.parent_account_id=d.descendant_id
  ), tb_rows as (
    select (r->>'account_id')::uuid account_id,
      ((r->>'opening_debit')::bigint-coalesce((r->>'opening_credit')::bigint,0))::bigint opening_balance,
      ((r->>'period_debit')::bigint-coalesce((r->>'period_credit')::bigint,0))::bigint period_balance,
      ((r->>'closing_debit')::bigint-coalesce((r->>'closing_credit')::bigint,0))::bigint closing_balance
    from jsonb_array_elements(coalesce(v_tb->'rows','[]'::jsonb)) r
  ), bs_rollup as (
    select d.root_id,
      coalesce(sum(coalesce(t.opening_balance,0)),0)::bigint opening_balance,
      coalesce(sum(coalesce(t.period_balance,0)),0)::bigint period_balance,
      coalesce(sum(coalesce(t.closing_balance,0)),0)::bigint closing_balance
    from descendants d left join tb_rows t on t.account_id=d.descendant_id
    group by d.root_id
  ), source as (
    select case when x.value->>'statement_type'='balance_sheet' then
      x.value || coalesce((select jsonb_build_object('opening',b.opening_balance,'period',b.period_balance,'balance',b.closing_balance) from bs_rollup b where b.root_id=(x.value->>'id')::uuid), '{}'::jsonb)
      else x.value end row,
      (x.value->>'id')::uuid id,nullif(x.value->>'parent_account_id','')::uuid parent_account_id,a.account_type,a.equity_rollforward_role
    from jsonb_array_elements(coalesce(v_raw,'[]'::jsonb)) x
    join public.accounts a on a.id=(x.value->>'id')::uuid and a.organization_id=p_organization_id
  ),$$
  );
  if v_new=v_def then raise exception 'Expected account-line opening/rollup patterns were not found'; end if;
  execute v_new;
end $outer$;