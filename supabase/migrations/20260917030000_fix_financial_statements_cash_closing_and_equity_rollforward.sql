-- Fix Financial Statements period closing cash and equity roll-forward semantics.
-- This migration patches the existing wrapper function in-place so it remains
-- compatible with the opening-snapshot implementation applied previously.

do $do$
declare
  src text;
  old text;
  new text;
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

  -- 1. Closing cash must equal opening cash plus selected-period movement.
  old := $old$select v_opening_cash + coalesce(sum(f.debit_minor-f.credit_minor),0)::bigint into v_closing_cash
    from public.financial_facts f join public.accounts a on a.id=f.account_id and a.organization_id=p_organization_id
    where f.organization_id=p_organization_id and f.fact_type='actual' and f.status='published'
      and a.cash_flow_role='cash' and f.transaction_date between v_opening_date and p_end_date$old$;
  new := $new$select v_opening_cash + coalesce(sum(f.debit_minor-f.credit_minor),0)::bigint into v_closing_cash
    from public.financial_facts f join public.accounts a on a.id=f.account_id and a.organization_id=p_organization_id
    where f.organization_id=p_organization_id and f.fact_type='actual' and f.status='published'
      and a.cash_flow_role='cash' and f.transaction_date between p_start_date and p_end_date$new$;
  if position(old in src)>0 then src:=replace(src,old,new); end if;

  -- 2. Balance-sheet totals must be calculated from hierarchy roots, not every
  -- parent and child row simultaneously.
  old := $old$select coalesce(sum(case when lower(coalesce(a.account_type,''))='asset' then (x.value->>'balance')::bigint else 0 end),0)::bigint,
      coalesce(sum(case when lower(coalesce(a.account_type,''))='liability' then -(x.value->>'balance')::bigint else 0 end),0)::bigint,
      coalesce(sum(case when lower(coalesce(a.account_type,''))='equity' then -(x.value->>'balance')::bigint else 0 end),0)::bigint,
      coalesce(sum(case when a.account_type='equity' and a.equity_rollforward_role='current_year_profit' then -(x.value->>'balance')::bigint else 0 end),0)::bigint
    into v_total_assets,v_total_liabilities,v_equity_accounts_total,v_profit_account_balance from jsonb_array_elements(coalesce(v_accounts,'[]'::jsonb)) x join public.accounts a on a.organization_id=p_organization_id and a.code=trim(x.value->>'code');$old$;
  new := $new$select coalesce(sum(case when lower(coalesce(a.account_type,''))='asset' then (x.value->>'balance')::bigint else 0 end),0)::bigint,
      coalesce(sum(case when lower(coalesce(a.account_type,''))='liability' then -(x.value->>'balance')::bigint else 0 end),0)::bigint,
      coalesce(sum(case when lower(coalesce(a.account_type,''))='equity' then -(x.value->>'balance')::bigint else 0 end),0)::bigint,
      coalesce(sum(case when a.account_type='equity' and a.equity_rollforward_role='current_year_profit' then -(x.value->>'balance')::bigint else 0 end),0)::bigint
    into v_total_assets,v_total_liabilities,v_equity_accounts_total,v_profit_account_balance
    from jsonb_array_elements(coalesce(v_accounts,'[]'::jsonb)) x
    join public.accounts a on a.organization_id=p_organization_id and a.code=trim(x.value->>'code')
    where a.parent_account_id is null
       or not exists (select 1 from public.accounts ap where ap.organization_id=p_organization_id and ap.id=a.parent_account_id and ap.statement_subclassification=a.statement_subclassification);$new$;
  if position(old in src)>0 then src:=replace(src,old,new); end if;

  -- 3. Prior fiscal-year-to-date profit is part of opening equity for a
  -- mid-year report. The selected-period profit is added separately.
  src:=replace(src,'to_jsonb(-v_opening_equity)','to_jsonb((-v_opening_equity)+(v_net_income-v_current_net_income))');
  src:=replace(src,'((-v_opening_equity)+m.capital_contributions+m.owner_distributions+m.retained_earnings+v_current_net_income+m.other_comprehensive_income)','(((-v_opening_equity)+(v_net_income-v_current_net_income))+m.capital_contributions+m.owner_distributions+m.retained_earnings+v_current_net_income+m.other_comprehensive_income)');

  execute src;
end $do$;
