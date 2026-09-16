-- jsonb_set requires a JSONB value. to_jsonb(NULL) is SQL NULL and would
-- propagate NULL through the entire report. Use an explicit JSON null instead.

do $do$
declare
  src text;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='get_financial_statements_date_range_filtered';

  if src is null then
    raise exception 'Financial statements function not found';
  end if;

  src:=replace(src, $$to_jsonb(null::bigint)$$, $$'null'::jsonb$$);
  execute src;
end $do$;
