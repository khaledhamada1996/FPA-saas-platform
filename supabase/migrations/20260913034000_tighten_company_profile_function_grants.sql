do $$ declare r record; begin
  for r in select p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('update_company_profile','create_child_company','get_organization_context','upsert_company_branch','delete_company_branch')
  loop
    execute 'revoke all on function '||r.sig||' from anon, public';
    execute 'grant execute on function '||r.sig||' to authenticated';
  end loop;
end $$;
