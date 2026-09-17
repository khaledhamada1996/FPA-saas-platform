do $outer$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_financial_statement_account_lines' and p.pronargs=10;
  if v_def is null then raise exception 'target function not found'; end if;
  v_new := replace(v_def,
    $$when account_type in ('liability','equity') then -(coalesce((row->>'own_balance')::bigint,0)+case when exists(select 1 from profit_ancestors p where p.id=source.id) then v_net_income else 0 end)$$,
    $$when account_type='liability' then -coalesce((row->>'own_balance')::bigint,0) when account_type='equity' then -coalesce((row->>'own_balance')::bigint,0)+case when exists(select 1 from profit_ancestors p where p.id=source.id) then v_net_income else 0 end$$
  );
  v_new := replace(v_new,
    $$when account_type in ('liability','equity') then -(coalesce((row->>'balance')::bigint,0)+case when exists(select 1 from profit_ancestors p where p.id=source.id) then v_net_income else 0 end)$$,
    $$when account_type='liability' then -coalesce((row->>'balance')::bigint,0) when account_type='equity' then -coalesce((row->>'balance')::bigint,0)+case when exists(select 1 from profit_ancestors p where p.id=source.id) then v_net_income else 0 end$$
  );
  if v_new=v_def then raise exception 'Expected equity sign patterns were not found'; end if;
  execute v_new;
end $outer$;