-- Sync ingestion contract: raw source payload boundary + source lineage.
create table if not exists public.sync_payloads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  sync_run_id uuid not null references public.data_sync_runs(id) on delete cascade,
  source_entity_type text not null,
  source_record_key text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_sync_payloads_run on public.sync_payloads(sync_run_id);
create index if not exists idx_sync_payloads_source_key on public.sync_payloads(data_source_id,source_entity_type,source_record_key);
alter table public.sync_payloads enable row level security;
drop policy if exists sync_payloads_deny_direct on public.sync_payloads;
create policy sync_payloads_deny_direct on public.sync_payloads for all to authenticated using(false) with check(false);
revoke all on public.sync_payloads from anon,authenticated;

create or replace function public.ingest_sync_payload(p_organization_id uuid,p_sync_run_id uuid,p_source_entity_type text,p_source_record_key text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_source uuid; v_status text;
begin
 if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_organization_id,'data_source.manage') then raise exception 'DATA_SOURCE_MANAGE_REQUIRED'; end if;
 select data_source_id,status into v_source,v_status from public.data_sync_runs where id=p_sync_run_id and organization_id=p_organization_id for update;
 if v_source is null then raise exception 'SYNC_RUN_NOT_FOUND'; end if;
 if v_status <> 'running' then raise exception 'SYNC_RUN_NOT_RUNNING'; end if;
 if not exists(select 1 from public.data_sources where id=v_source and organization_id=p_organization_id) then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
 if p_source_entity_type is null or btrim(p_source_entity_type)='' or p_source_record_key is null or btrim(p_source_record_key)='' then raise exception 'SOURCE_RECORD_KEY_REQUIRED'; end if;
 if p_payload is null then raise exception 'PAYLOAD_REQUIRED'; end if;
 insert into public.sync_payloads(organization_id,data_source_id,sync_run_id,source_entity_type,source_record_key,payload) values(p_organization_id,v_source,p_sync_run_id,btrim(p_source_entity_type),btrim(p_source_record_key),p_payload) returning id into v_id;
 insert into public.data_lineage(organization_id,data_source_id,sync_run_id,source_record_key,source_entity_type,source_reference,observed_at) values(p_organization_id,v_source,p_sync_run_id,btrim(p_source_record_key),btrim(p_source_entity_type),btrim(p_source_record_key),now());
 return v_id;
end; $$;
revoke all on function public.ingest_sync_payload(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.ingest_sync_payload(uuid,uuid,text,text,jsonb) to authenticated;

create or replace function public.complete_data_sync_run(p_organization_id uuid,p_sync_run_id uuid,p_status text,p_records_received integer,p_records_accepted integer,p_records_rejected integer,p_error_count integer,p_warning_count integer,p_error_message text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_source uuid;
begin
 if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_organization_id,'data_source.manage') then raise exception 'DATA_SOURCE_MANAGE_REQUIRED'; end if;
 if p_status not in ('succeeded','partial','failed') then raise exception 'INVALID_SYNC_STATUS'; end if;
 select data_source_id into v_source from public.data_sync_runs where id=p_sync_run_id and organization_id=p_organization_id and status='running' for update;
 if v_source is null then raise exception 'SYNC_RUN_NOT_FOUND_OR_COMPLETED'; end if;
 update public.data_sync_runs set completed_at=now(),status=p_status,records_received=greatest(coalesce(p_records_received,0),0),records_accepted=greatest(coalesce(p_records_accepted,0),0),records_rejected=greatest(coalesce(p_records_rejected,0),0),error_count=greatest(coalesce(p_error_count,0),0),warning_count=greatest(coalesce(p_warning_count,0),0),error_message=nullif(btrim(coalesce(p_error_message,'')),'') where id=p_sync_run_id;
 update public.data_sources set last_sync_at=now(),last_success_at=case when p_status='succeeded' then now() else last_success_at end,last_error_at=case when p_status='failed' then now() else last_error_at end,last_error_message=case when p_status='failed' then nullif(btrim(coalesce(p_error_message,'')),'') else null end,status=case when p_status='failed' then 'error' else 'active' end,updated_at=now() where id=v_source and organization_id=p_organization_id;
 return true;
end; $$;
revoke all on function public.complete_data_sync_run(uuid,uuid,text,integer,integer,integer,integer,integer,text) from public,anon;
grant execute on function public.complete_data_sync_run(uuid,uuid,text,integer,integer,integer,integer,integer,text) to authenticated;
