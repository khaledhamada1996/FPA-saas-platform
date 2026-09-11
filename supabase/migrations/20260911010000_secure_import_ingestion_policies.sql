create policy "imports_member_insert" on public.imports for insert to authenticated with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.organization_members om
    where om.organization_id = imports.organization_id
      and om.user_id = (select auth.uid())
  )
);

create policy "imports_member_update" on public.imports for update to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = imports.organization_id
      and om.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = imports.organization_id
      and om.user_id = (select auth.uid())
  )
);

create policy "import_rows_member_insert" on public.import_rows for insert to authenticated with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = import_rows.organization_id
      and om.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.imports i
    where i.id = import_rows.import_id
      and i.organization_id = import_rows.organization_id
  )
);

grant select, insert, update on table public.imports to authenticated;
grant select, insert on table public.import_rows to authenticated;
