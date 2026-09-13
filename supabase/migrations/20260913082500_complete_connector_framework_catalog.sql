-- Complete the connector framework foundation already present in production.
-- No credentials/secrets are stored here; connection_ref is only an external secret-manager reference.

insert into public.connector_catalog
  (connector_key, display_name, category, supported_source_type, auth_type, capabilities, supported_entities, status)
values
  ('excel_csv','Excel / CSV','file','excel_csv','none','{"import":true,"sync":false}'::jsonb,
    ARRAY['journal_transactions','trial_balance','chart_of_accounts','master_data','planning_data'],'available'),
  ('generic_api','Generic API','api','api','secret_reference','{"sync":true,"webhook":true}'::jsonb,
    ARRAY['journal_transactions','trial_balance','chart_of_accounts','master_data'],'planned'),
  ('generic_database','Generic Database','database','database','secret_reference','{"sync":true,"incremental":true}'::jsonb,
    ARRAY['journal_transactions','trial_balance','chart_of_accounts','master_data'],'planned')
on conflict (connector_key) do update set
  display_name=excluded.display_name,
  category=excluded.category,
  supported_source_type=excluded.supported_source_type,
  auth_type=excluded.auth_type,
  capabilities=excluded.capabilities,
  supported_entities=excluded.supported_entities,
  status=excluded.status,
  updated_at=now();

create index if not exists idx_connector_catalog_source_status
  on public.connector_catalog(supported_source_type,status);
create index if not exists idx_data_source_connectors_connector
  on public.data_source_connectors(connector_id);

alter table public.connector_catalog enable row level security;
alter table public.data_source_connectors enable row level security;

drop policy if exists connector_catalog_deny_direct on public.connector_catalog;
create policy connector_catalog_deny_direct
  on public.connector_catalog for all to authenticated
  using (false) with check (false);

drop policy if exists data_source_connectors_deny_direct on public.data_source_connectors;
create policy data_source_connectors_deny_direct
  on public.data_source_connectors for all to authenticated
  using (false) with check (false);

revoke all on public.connector_catalog from anon, authenticated;
revoke all on public.data_source_connectors from anon, authenticated;

create or replace function public.get_data_source_connectors(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_out jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_permission(p_organization_id,'connector.view') then raise exception 'PERMISSION_DENIED'; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',dsc.id,
      'data_source_id',dsc.data_source_id,
      'connector_id',dsc.connector_id,
      'connector_key',c.connector_key,
      'display_name',c.display_name,
      'connection_ref',dsc.connection_ref,
      'sync_config',dsc.sync_config,
      'enabled',dsc.enabled,
      'last_success_at',dsc.last_success_at,
      'last_error_message',dsc.last_error_message
    ) order by c.display_name
  ),'[]'::jsonb)
  into v_out
  from public.data_source_connectors dsc
  join public.connector_catalog c on c.id=dsc.connector_id
  where dsc.organization_id=p_organization_id;

  return v_out;
end;
$function$;

revoke all on function public.get_data_source_connectors(uuid) from public, anon;
grant execute on function public.get_data_source_connectors(uuid) to authenticated;
