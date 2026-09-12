revoke all on function public.publish_actual_import(uuid, text, jsonb) from public, anon, authenticated;
drop function if exists public.publish_actual_import(uuid, text, jsonb);
drop table if exists public.actual_import_batches;
