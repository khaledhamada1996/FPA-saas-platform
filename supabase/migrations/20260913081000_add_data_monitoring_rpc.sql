create or replace function public.get_data_monitoring(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_sources jsonb; v_runs jsonb; v_summary jsonb;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_organization_id,'data_monitoring.view') then raise exception 'PERMISSION_DENIED'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_sources from (
  select ds.id,ds.source_type,ds.system_name,ds.status,ds.sync_mode,ds.last_sync_at,ds.last_success_at,ds.last_error_at,ds.last_error_message,ds.created_at,ds.updated_at,
   case when ds.status in ('error','disconnected') then 'error' when ds.last_success_at is null then 'never' when ds.last_success_at < now()-interval '24 hours' then 'stale' else 'healthy' end health_status
  from public.data_sources ds where ds.organization_id=p_organization_id) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.started_at desc),'[]'::jsonb) into v_runs from (
  select r.id,r.data_source_id,ds.system_name,r.started_at,r.completed_at,r.status,r.records_received,r.records_accepted,r.records_rejected,r.error_count,r.warning_count,r.error_message
  from public.data_sync_runs r join public.data_sources ds on ds.id=r.data_source_id where r.organization_id=p_organization_id order by r.started_at desc limit 50) x;
 select jsonb_build_object(
  'sources_total',(select count(*) from public.data_sources where organization_id=p_organization_id),
  'sources_healthy',(select count(*) from public.data_sources where organization_id=p_organization_id and status not in ('error','disconnected') and last_success_at >= now()-interval '24 hours'),
  'sources_stale',(select count(*) from public.data_sources where organization_id=p_organization_id and status not in ('error','disconnected') and (last_success_at is null or last_success_at < now()-interval '24 hours')),
  'sources_error',(select count(*) from public.data_sources where organization_id=p_organization_id and status in ('error','disconnected')),
  'sync_runs_24h',(select count(*) from public.data_sync_runs where organization_id=p_organization_id and started_at >= now()-interval '24 hours'),
  'failed_runs_24h',(select count(*) from public.data_sync_runs where organization_id=p_organization_id and started_at >= now()-interval '24 hours' and status='failed'),
  'rejected_records_24h',(select coalesce(sum(records_rejected),0) from public.data_sync_runs where organization_id=p_organization_id and started_at >= now()-interval '24 hours')) into v_summary;
 return jsonb_build_object('summary',v_summary,'sources',v_sources,'recent_sync_runs',v_runs);
end; $$;
revoke all on function public.get_data_monitoring(uuid) from public,anon;
grant execute on function public.get_data_monitoring(uuid) to authenticated;
create index if not exists idx_data_sync_runs_org_started on public.data_sync_runs(organization_id,started_at desc);
create index if not exists idx_data_sources_org_last_success on public.data_sources(organization_id,last_success_at);

update public.organization_permissions
set screen_key='screen.data_monitoring.view', route_path='/workspace/data-monitoring', category='data', sort_order=35
where permission_key='data_monitoring.view';
