-- Expose only the table operations required by the Import & Mapping API.
-- RLS controls rows; grants control whether the role can reach the operation at all.

revoke all on table public.imports from anon, authenticated;
grant select, insert, update on table public.imports to authenticated;

revoke all on table public.import_rows from anon, authenticated;
grant select, insert on table public.import_rows to authenticated;

revoke all on table public.account_mappings from anon, authenticated;
grant select on table public.account_mappings to authenticated;

revoke all on table public.actuals_publish_batches from anon, authenticated;
grant select on table public.actuals_publish_batches to authenticated;

-- Legacy import batch storage is no longer part of the active publish path.
revoke all on table public.actual_import_batches from anon, authenticated;
