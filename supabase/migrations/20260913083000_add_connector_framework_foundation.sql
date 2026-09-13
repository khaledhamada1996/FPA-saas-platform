create table if not exists public.connector_catalog (
  id uuid primary key default gen_random_uuid(),
  connector_key text not null unique,
  display_name text not null,
  category text not null default 'other',
  supported_source_type text not null,
  auth_type text not null default 'reference_only',
  capabilities jsonb not null default '{}'::jsonb,
  supported_entities text[] not null default '{}',
  status text not null default 'planned' check (status in ('planned','available','deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_source_connectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  connector_id uuid not null references public.connector_catalog(id) on delete restrict,
  connection_ref text,
  sync_cursor jsonb not null default '{}'::jsonb,
  sync_config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(data_source_id, connector_id)
);

create index if not exists idx_connector_catalog_status on public.connector_catalog(status, category);
create index if not exists idx_data_source_connectors_org on public.data_source_connectors(organization_id, enabled);
create index if not exists idx_data_source_connectors_source on public.data_source_connectors(data_source_id);

alter table public.connector_catalog enable row level security;
alter table public.data_source_connectors enable row level security;

drop policy if exists connector_catalog_deny_direct on public.connector_catalog;
create policy connector_catalog_deny_direct on public.connector_catalog for all to authenticated using (false) with check (false);
drop policy if exists data_source_connectors_deny_direct on public.data_source_connectors;
create policy data_source_connectors_deny_direct on public.data_source_connectors for all to authenticated using (false) with check (false);
revoke all on public.connector_catalog from anon, authenticated;
revoke all on public.data_source_connectors from anon, authenticated;

do $$ begin
  insert into public.organization_permissions(permission_key,name,description,permission_type,category,sort_order)
  values
    ('connector.view','عرض الموصلات','عرض كتالوج الموصلات وإعدادات ربط مصادر البيانات','read','data',36),
    ('connector.manage','إدارة الموصلات','إضافة وتعطيل وربط الموصلات بمصادر البيانات','write','data',37)
  on conflict (permission_key) do update set
    name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,
    category=excluded.category,sort_order=excluded.sort_order;

  insert into public.connector_catalog(connector_key,display_name,category,supported_source_type,auth_type,capabilities,supported_entities,status)
  values
    ('excel_csv','Excel / CSV','file','excel_csv','reference_only','{"ingest":true,"scheduled_sync":false,"webhook":false}'::jsonb,'{actual_journal_transactions,trial_balance,chart_of_accounts,master_data,planning_data}','available'),
    ('generic_api','Generic API','api','api','reference_only','{"ingest":true,"scheduled_sync":true,"webhook":true}'::jsonb,'{actual_journal_transactions,trial_balance,chart_of_accounts,master_data}','planned'),
    ('generic_database','Generic Database','database','database','reference_only','{"ingest":true,"scheduled_sync":true,"webhook":false}'::jsonb,'{actual_journal_transactions,trial_balance,chart_of_accounts,master_data}','planned')
  on conflict (connector_key) do update set
    display_name=excluded.display_name,capabilities=excluded.capabilities,
    supported_entities=excluded.supported_entities,status=excluded.status;

  insert into public.organization_role_permissions(organization_id,role_key,permission_key)
  select o.id,r.role_key,p.permission_key
  from public.organizations o
  cross join public.organization_roles r
  cross join public.organization_permissions p
  where r.hierarchy_level >= 90
    and p.permission_key in ('connector.view','connector.manage')
  on conflict do nothing;
end $$;

create or replace function public.get_connector_catalog(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_out jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_permission(p_organization_id,'connector.view') then raise exception 'PERMISSION_DENIED'; end if;
  select jsonb_agg(jsonb_build_object(
    'id',c.id,'connector_key',c.connector_key,'display_name',c.display_name,'category',c.category,
    'supported_source_type',c.supported_source_type,'auth_type',c.auth_type,
    'capabilities',c.capabilities,'supported_entities',c.supported_entities,'status',c.status
  ) order by c.display_name) into v_out
  from public.connector_catalog c;
  return coalesce(v_out,'[]'::jsonb);
end;
$$;

create or replace function public.attach_data_source_connector(
  p_organization_id uuid,
  p_data_source_id uuid,
  p_connector_id uuid,
  p_connection_ref text default null,
  p_sync_config jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_source_type text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_permission(p_organization_id,'connector.manage') then raise exception 'PERMISSION_DENIED'; end if;
  select ds.source_type into v_source_type
  from public.data_sources ds
  where ds.id=p_data_source_id and ds.organization_id=p_organization_id;
  if v_source_type is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.connector_catalog c
    where c.id=p_connector_id and c.status='available'
      and c.supported_source_type=v_source_type
  ) then raise exception 'CONNECTOR_NOT_AVAILABLE_FOR_SOURCE'; end if;
  insert into public.data_source_connectors(
    organization_id,data_source_id,connector_id,connection_ref,sync_config,created_by
  ) values (
    p_organization_id,p_data_source_id,p_connector_id,
    nullif(trim(p_connection_ref),''),coalesce(p_sync_config,'{}'::jsonb),v_uid
  )
  on conflict (data_source_id,connector_id) do update set
    connection_ref=excluded.connection_ref,
    sync_config=excluded.sync_config,
    enabled=true,
    updated_at=now()
  returning id into v_id;
  perform public.write_audit_event(
    p_organization_id,'connector.attach','data_source_connector',v_id::text,null,
    jsonb_build_object('data_source_id',p_data_source_id,'connector_id',p_connector_id)
  );
  return v_id;
end;
$$;

revoke all on function public.get_connector_catalog(uuid) from public,anon;
grant execute on function public.get_connector_catalog(uuid) to authenticated;
revoke all on function public.attach_data_source_connector(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.attach_data_source_connector(uuid,uuid,uuid,text,jsonb) to authenticated;

comment on table public.connector_catalog is 'Catalog of connector capabilities. Credentials are never stored here.';
comment on table public.data_source_connectors is 'Tenant-scoped connector bindings. connection_ref is a reference only; secrets belong in an external secret manager.';
