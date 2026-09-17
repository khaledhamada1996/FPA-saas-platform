do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='get_financial_statement_account_lines'
    and p.pronargs=10;

  if v_def is null then
    raise exception 'get_financial_statement_account_lines target function not found';
  end if;

  v_new := replace(
    v_def,
    'join profit_ancestors p on p.id=s.parent_account_id',
    'join profit_ancestors p on s.id=p.parent_account_id'
  );

  if v_new = v_def then
    raise exception 'Expected equity ancestor recursion pattern was not found';
  end if;

  execute v_new;
end $$;