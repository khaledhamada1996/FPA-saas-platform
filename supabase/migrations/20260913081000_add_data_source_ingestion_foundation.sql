-- Unified FP&A data source layer: manual, files and integrations converge into the same model.
create table if not exists public.data_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null check (source_type in ('manual','excel_csv','integration','api','database','other')),
  system_name text,
  connection_key text,
  status text not null default 'active' check (status in ('active','paused','error','disconnected')),
  sync_mode text not null default 'manual' check (sync_mode in ('manual','scheduled','near_real_time','real_time')),
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running','succeeded','partial','failed')),
  records_received integer not null default 0,
  records_accepted integer not null default 0,
  records_rejected integer not null default 0,
  error_count integer not null default 0,
  warning_count integer not null default 0,
  error_message text,
  created_by uuid
);

create table if not exists public.data_lineage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data_source_id uuid references public.data_sources(id) on delete set null,
  sync_run_id uuid references public.data_sync_runs(id) on delete set null,
  source_record_key text,
  source_entity_type text,
  normalized_entity_type text not null,
  normalized_record_id uuid,
  source_reference text,
  mapping_version text,
  observed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_data_sources_org_status on public.data_sources(organization_id,status);
create index if not exists idx_data_sync_runs_source_started on public.data_sync_runs(data_source_id,started_at desc);
create index if not exists idx_data_lineage_normalized on public.data_lineage(organization_id,normalized_entity_type,normalized_record_id);
create index if not exists idx_data_lineage_source on public.data_lineage(data_source_id,source_record_key);

alter table public.data_sources enable row level security;
alter table public.data_sync_runs enable row level security;
alter table public.data_lineage enable row level security;

create policy data_sources_deny_direct on public.data_sources for all to authenticated using (false) with check (false);
create policy data_sync_runs_deny_direct on public.data_sync_runs for all to authenticated using (false) with check (false);
create policy data_lineage_deny_direct on public.data_lineage for all to authenticated using (false) with check (false);

revoke all on public.data_sources from anon, authenticated;
revoke all on public.data_sync_runs from anon, authenticated;
revoke all on public.data_lineage from anon, authenticated;

comment on table public.data_sources is 'Canonical registry of FP&A data sources. Manual, file and integrations converge here.';
comment on table public.data_sync_runs is 'Operational history of data ingestion and synchronization runs.';
comment on table public.data_lineage is 'Source-to-normalized record lineage for auditability and drill-through.';

insert into public.organization_permissions(permission_key,name,description,permission_type,category,sort_order) values
('data_source.view','View data sources','View connected sources and ingestion health','action','data',900),
('data_source.manage','Manage data sources','Create, update, pause and disconnect data sources','action','data',901),
('data_sync.view','View synchronization runs','View synchronization history and data quality status','action','data',902),
('data_lineage.view','View data lineage','Trace normalized data back to its source','action','data',903),
('data_monitoring.view','View data monitoring','View live data freshness, quality and ingestion alerts','screen','data',904)
on conflict (permission_key) do update set name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,category=excluded.category,sort_order=excluded.sort_order;

insert into public.organization_role_permissions(organization_id,role_key,permission_key)
select r.organization_id,r.role_key,p.permission_key
from public.organization_roles r cross join public.organization_permissions p
where r.hierarchy_level >= 90
and p.permission_key in ('data_source.view','data_source.manage','data_sync.view','data_lineage.view','data_monitoring.view')
on conflict do nothing;
