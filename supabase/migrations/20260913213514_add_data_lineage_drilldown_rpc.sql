create index if not exists data_lineage_org_normalized_idx
  on public.data_lineage (organization_id, normalized_entity_type, normalized_record_id);

create index if not exists data_lineage_org_source_key_idx
  on public.data_lineage (organization_id, source_record_key);

create or replace function public.get_data_lineage(
  p_organization_id uuid,
  p_normalized_entity_type text default null,
  p_normalized_record_id uuid default null,
  p_source_record_key text default null
)
returns table (
  id uuid,
  data_source_id uuid,
  data_source_name text,
  data_source_type text,
  sync_run_id uuid,
  sync_status text,
  source_record_key text,
  source_entity_type text,
  normalized_entity_type text,
  normalized_record_id uuid,
  source_reference text,
  mapping_version text,
  observed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.has_org_permission(p_organization_id, 'data_lineage.view') then
    raise exception 'insufficient permission' using errcode = '42501';
  end if;
  if p_normalized_entity_type is null and p_normalized_record_id is null and p_source_record_key is null then
    return query
      select dl.id, dl.data_source_id, ds.system_name, ds.source_type, dl.sync_run_id,
             sr.status, dl.source_record_key, dl.source_entity_type,
             dl.normalized_entity_type, dl.normalized_record_id, dl.source_reference,
             dl.mapping_version, dl.observed_at, dl.created_at
      from public.data_lineage dl
      left join public.data_sources ds on ds.id = dl.data_source_id and ds.organization_id = dl.organization_id
      left join public.data_sync_runs sr on sr.id = dl.sync_run_id and sr.organization_id = dl.organization_id
      where dl.organization_id = p_organization_id
      order by coalesce(dl.observed_at, dl.created_at) desc, dl.created_at desc;
  else
    return query
      select dl.id, dl.data_source_id, ds.system_name, ds.source_type, dl.sync_run_id,
             sr.status, dl.source_record_key, dl.source_entity_type,
             dl.normalized_entity_type, dl.normalized_record_id, dl.source_reference,
             dl.mapping_version, dl.observed_at, dl.created_at
      from public.data_lineage dl
      left join public.data_sources ds on ds.id = dl.data_source_id and ds.organization_id = dl.organization_id
      left join public.data_sync_runs sr on sr.id = dl.sync_run_id and sr.organization_id = dl.organization_id
      where dl.organization_id = p_organization_id
        and (p_normalized_entity_type is null or dl.normalized_entity_type = p_normalized_entity_type)
        and (p_normalized_record_id is null or dl.normalized_record_id = p_normalized_record_id)
        and (p_source_record_key is null or dl.source_record_key = p_source_record_key)
      order by coalesce(dl.observed_at, dl.created_at) desc, dl.created_at desc;
  end if;
end;
$$;

revoke all on function public.get_data_lineage(uuid, text, uuid, text) from public;
revoke all on function public.get_data_lineage(uuid, text, uuid, text) from anon;
grant execute on function public.get_data_lineage(uuid, text, uuid, text) to authenticated;
