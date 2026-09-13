-- Harden connector bindings and establish an authoritative sync-run lifecycle.
create or replace function public.attach_data_source_connector(
  p_organization_id uuid,
  p_data_source_id uuid,
  p_connector_id uuid,
  p_connection_ref text default null,
  p_sync_config jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid := (select auth.uid()); v_id uuid; v_source_type text; v_before jsonb; v_after jsonb; v_bad_key text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_permission(p_organization_id,'connector.manage') then raise exception 'PERMISSION_DENIED'; end if;
  if p_connection_ref is not null and length(trim(p_connection_ref)) > 500 then raise exception 'CONNECTION_REFERENCE_TOO_LONG'; end if;
  select ds.source_type into v_source_type from public.data_sources ds where ds.id=p_data_source_id and ds.organization_id=p_organization_id;
  if v_source_type is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
  if not exists (select 1 from public.connector_catalog c where c.id=p_connector_id and c.status='available' and c.supported_source_type=v_source_type) then raise exception 'CONNECTOR_NOT_AVAILABLE_FOR_SOURCE'; end if;
  select key into v_bad_key from jsonb_object_keys(coalesce(p_sync_config,'{}'::jsonb)) key where lower(key) similar to '%(secret|password|token|credential|api[_-]?key|private[_-]?key)%' limit 1;
  if v_bad_key is not null then raise exception 'SECRET_MUST_USE_EXTERNAL_SECRET_MANAGER'; end if;
  select to_jsonb(dsc) into v_before from public.data_source_connectors dsc where dsc.organization_id=p_organization_id and dsc.data_source_id=p_data_source_id and dsc.connector_id=p_connector_id;
  insert into public.data_source_connectors(organization_id,data_source_id,connector_id,connection_ref,sync_config,created_by)
  values(p_organization_id,p_data_source_id,p_connector_id,nullif(trim(p_connection_ref),''),coalesce(p_sync_config,'{}'::jsonb),v_uid)
  on conflict (data_source_id,connector_id) do update set connection_ref=excluded.connection_ref,sync_config=excluded.sync_config,enabled=true,updated_at=now()
  returning id into v_id;
  select to_jsonb(dsc) into v_after from public.data_source_connectors dsc where dsc.id=v_id;
  perform public.write_audit_event(p_organization_id,case when v_before is null then 'connector.attach' else 'connector.update' end,'data_source_connector',v_id::text,v_before,v_after);
  return v_id;
end;
$$;

create or replace function public.detach_data_source_connector(p_organization_id uuid,p_data_source_connector_id uuid) returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid := (select auth.uid()); v_before jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_permission(p_organization_id,'connector.manage') then raise exception 'PERMISSION_DENIED'; end if;
  select to_jsonb(dsc) into v_before from public.data_source_connectors dsc where dsc.id=p_data_source_connector_id and dsc.organization_id=p_organization_id;
  if v_before is null then raise exception 'CONNECTOR_BINDING_NOT_FOUND'; end if;
  delete from public.data_source_connectors where id=p_data_source_connector_id and organization_id=p_organization_id;
  perform public.write_audit_event(p_organization_id,'connector.detach','data_source_connector',p_data_source_connector_id::text,v_before,null);
  return true;
end;
$$;

create or replace function public.start_data_sync_run(p_organization_id uuid,p_data_source_id uuid) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid := (select auth.uid()); v_run uuid; v_status text; v_enabled boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_permission(p_organization_id,'data_source.manage') then raise exception 'PERMISSION_DENIED'; end if;
  select ds.status into v_status from public.data_sources ds where ds.id=p_data_source_id and ds.organization_id=p_organization_id;
  if v_status is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
  if v_status in ('paused','disconnected','error') then raise exception 'DATA_SOURCE_NOT_READY'; end if;
  select dsc.enabled into v_enabled from public.data_source_connectors dsc where dsc.organization_id=p_organization_id and dsc.data_source_id=p_data_source_id order by dsc.created_at desc limit 1;
  if coalesce(v_enabled,false)=false then raise exception 'NO_ENABLED_CONNECTOR'; end if;
  if exists(select 1 from public.data_sync_runs r where r.organization_id=p_organization_id and r.data_source_id=p_data_source_id and r.status='running') then raise exception 'SYNC_ALREADY_RUNNING'; end if;
  insert into public.data_sync_runs(organization_id,data_source_id,status,created_by) values(p_organization_id,p_data_source_id,'running',v_uid) returning id into v_run;
  update public.data_sources set last_sync_at=now(),updated_at=now() where id=p_data_source_id and organization_id=p_organization_id;
  update public.data_source_connectors set last_started_at=now(),updated_at=now() where organization_id=p_organization_id and data_source_id=p_data_source_id and enabled=true;
  perform public.write_audit_event(p_organization_id,'data_sync.start','data_sync_run',v_run::text,null,jsonb_build_object('data_source_id',p_data_source_id));
  return v_run;
end;
$$;

create or replace function public.complete_data_sync_run(p_organization_id uuid,p_sync_run_id uuid,p_status text,p_records_received integer default 0,p_records_accepted integer default 0,p_records_rejected integer default 0,p_error_count integer default 0,p_warning_count integer default 0,p_error_message text default null) returns boolean
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid := (select auth.uid()); v_source uuid; v_before jsonb; v_after jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_permission(p_organization_id,'data_source.manage') then raise exception 'PERMISSION_DENIED'; end if;
  if p_status not in ('succeeded','partial','failed') then raise exception 'INVALID_SYNC_STATUS'; end if;
  if least(p_records_received,p_records_accepted,p_records_rejected,p_error_count,p_warning_count)<0 then raise exception 'INVALID_SYNC_COUNTS'; end if;
  select r.data_source_id,to_jsonb(r) into v_source,v_before from public.data_sync_runs r where r.id=p_sync_run_id and r.organization_id=p_organization_id and r.status='running';
  if v_source is null then raise exception 'SYNC_RUN_NOT_FOUND'; end if;
  update public.data_sync_runs set completed_at=now(),status=p_status,records_received=p_records_received,records_accepted=p_records_accepted,records_rejected=p_records_rejected,error_count=p_error_count,warning_count=p_warning_count,error_message=p_error_message where id=p_sync_run_id and organization_id=p_organization_id;
  select to_jsonb(r) into v_after from public.data_sync_runs r where r.id=p_sync_run_id;
  update public.data_sources set last_success_at=case when p_status in ('succeeded','partial') then now() else last_success_at end,last_error_at=case when p_status='failed' then now() else last_error_at end,last_error_message=case when p_status='failed' then p_error_message else null end,status=case when p_status='failed' then 'error' else 'active' end,updated_at=now() where id=v_source and organization_id=p_organization_id;
  update public.data_source_connectors set last_completed_at=now(),last_success_at=case when p_status in ('succeeded','partial') then now() else last_success_at end,last_error_at=case when p_status='failed' then now() else last_error_at end,last_error_message=case when p_status='failed' then p_error_message else null end,updated_at=now() where data_source_id=v_source and organization_id=p_organization_id;
  perform public.write_audit_event(p_organization_id,'data_sync.complete','data_sync_run',p_sync_run_id::text,v_before,v_after);
  return true;
end;
$$;

revoke all on function public.attach_data_source_connector(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.attach_data_source_connector(uuid,uuid,uuid,text,jsonb) to authenticated;
revoke all on function public.detach_data_source_connector(uuid,uuid) from public,anon;
grant execute on function public.detach_data_source_connector(uuid,uuid) to authenticated;
revoke all on function public.start_data_sync_run(uuid,uuid) from public,anon;
grant execute on function public.start_data_sync_run(uuid,uuid) to authenticated;
revoke all on function public.complete_data_sync_run(uuid,uuid,text,integer,integer,integer,integer,integer,text) from public,anon;
grant execute on function public.complete_data_sync_run(uuid,uuid,text,integer,integer,integer,integer,integer,text) to authenticated;
