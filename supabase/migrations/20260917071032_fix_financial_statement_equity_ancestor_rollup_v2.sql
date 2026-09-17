do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_financial_statement_account_lines' and p.pronargs=10;
  if v_def is null then raise exception 'target function not found'; end if;

  v_new := replace(
    v_def,
    'profit_ancestors as (select id from profit union all select s.id from source s join profit_ancestors p on s.id=p.parent_account_id)',
    'profit_ancestors as (select id,parent_account_id from source where equity_rollforward_role=''current_year_profit'' union all select s.id,s.parent_account_id from source s join profit_ancestors p on s.id=p.parent_account_id)'
  );
  if v_new = v_def then raise exception 'Expected broken equity ancestor recursion pattern was not found'; end if;
  execute v_new;
end $$;