create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  connector_id uuid references public.data_source_connectors(id) on delete set null,
  provider text not null,
  event_type text not null,
  external_event_id text not null,
  delivery_id text,
  signature_verified boolean not null default false,
  received_at timestamptz not null default now(),
  occurred_at timestamptz,
  status text not null default 'received' check (status in ('received','processing','processed','failed','ignored')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_event_id),
  unique (provider, delivery_id)
);
create index if not exists integration_events_org_received_idx on public.integration_events(organization_id, received_at desc);
create index if not exists integration_events_source_status_idx on public.integration_events(data_source_id, status, received_at desc);
alter table public.integration_events enable row level security;
drop policy if exists integration_events_deny_direct on public.integration_events;
create policy integration_events_deny_direct on public.integration_events for all using (false) with check (false);

alter table public.data_source_connectors
  add column if not exists webhook_enabled boolean not null default false,
  add column if not exists webhook_secret_ref text,
  add column if not exists webhook_endpoint_ref text;

insert into public.connector_catalog
  (connector_key,display_name,category,supported_source_type,auth_type,capabilities,supported_entities,status)
values
  ('qoyod','قيود','accounting','api','secret_reference','{"sync":true,"incremental":true,"webhook":true,"read_accounts":true,"read_journal_entries":true}'::jsonb,array['accounts','journal_transactions','customers','vendors','products','invoices','payments'],'available'),
  ('odoo','Odoo','accounting','api','secret_reference','{"sync":true,"incremental":true,"webhook":true,"read_accounts":true,"read_journal_entries":true}'::jsonb,array['accounts','journal_transactions','customers','vendors','products','invoices','payments'],'available'),
  ('zoho_books','Zoho Books','accounting','api','secret_reference','{"sync":true,"incremental":true,"webhook":true,"read_accounts":true,"read_journal_entries":true}'::jsonb,array['accounts','journal_transactions','customers','vendors','items','invoices','payments'],'available'),
  ('foodics','Foodics','business','api','secret_reference','{"sync":true,"incremental":true,"webhook":true}'::jsonb,array['sales','payments','products','customers'],'available'),
  ('salla','Salla','commerce','api','secret_reference','{"sync":true,"incremental":true,"webhook":true}'::jsonb,array['orders','payments','products','customers'],'available'),
  ('zid','Zid','commerce','api','secret_reference','{"sync":true,"incremental":true,"webhook":true}'::jsonb,array['orders','payments','products','customers'],'available')
on conflict (connector_key) do update set display_name=excluded.display_name,category=excluded.category,supported_source_type=excluded.supported_source_type,auth_type=excluded.auth_type,capabilities=excluded.capabilities,supported_entities=excluded.supported_entities,status=excluded.status,updated_at=now();

create or replace function public.record_integration_event(
  p_organization_id uuid,p_data_source_id uuid,p_connector_id uuid,p_provider text,p_event_type text,
  p_external_event_id text,p_delivery_id text,p_signature_verified boolean,p_occurred_at timestamptz,p_payload jsonb
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_id uuid;
begin
  if p_organization_id is null or p_data_source_id is null or nullif(btrim(p_provider),'') is null
     or nullif(btrim(p_event_type),'') is null or nullif(btrim(p_external_event_id),'') is null
  then raise exception 'INTEGRATION_EVENT_FIELDS_REQUIRED'; end if;
  insert into public.integration_events(organization_id,data_source_id,connector_id,provider,event_type,external_event_id,delivery_id,signature_verified,occurred_at,payload)
  values(p_organization_id,p_data_source_id,p_connector_id,btrim(p_provider),btrim(p_event_type),btrim(p_external_event_id),nullif(btrim(p_delivery_id),''),coalesce(p_signature_verified,false),p_occurred_at,coalesce(p_payload,'{}'::jsonb))
  on conflict (provider,external_event_id) do update set delivery_id=coalesce(excluded.delivery_id,public.integration_events.delivery_id),signature_verified=public.integration_events.signature_verified or excluded.signature_verified
  returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.record_integration_event(uuid,uuid,uuid,text,text,text,text,boolean,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.record_integration_event(uuid,uuid,uuid,text,text,text,text,boolean,timestamptz,jsonb) to service_role;
