revoke all on function public.publish_actual_import(uuid, text, jsonb) from public, anon, authenticated;

comment on function public.publish_actual_import(uuid, text, jsonb) is
  'Legacy import publish RPC disabled. Use publish_actuals_from_import(uuid, text), which enforces the import permission model.';
