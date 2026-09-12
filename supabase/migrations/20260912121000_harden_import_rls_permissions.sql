-- Security hardening: direct import table access must honor the same
-- organization-level import permission enforced by the ingestion workflow.
-- This prevents authenticated members from bypassing the secured import path
-- through direct INSERT/UPDATE against imports or import_rows.

drop policy if exists "imports_member_insert" on public.imports;
drop policy if exists "imports_member_update" on public.imports;
drop policy if exists "import_rows_member_insert" on public.import_rows;

create policy "imports_member_insert" on public.imports
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_org_permission(
    imports.organization_id,
    'import'
  )
);

create policy "imports_member_update" on public.imports
for update to authenticated
using (
  public.has_org_permission(
    imports.organization_id,
    'import'
  )
)
with check (
  public.has_org_permission(
    imports.organization_id,
    'import'
  )
);

create policy "import_rows_member_insert" on public.import_rows
for insert to authenticated
with check (
  public.has_org_permission(
    import_rows.organization_id,
    'import'
  )
  and exists (
    select 1
    from public.imports i
    where i.id = import_rows.import_id
      and i.organization_id = import_rows.organization_id
  )
);
