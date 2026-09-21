-- Integration account mapping layer.
-- Reuses approved organization account_mappings; no external system is modified.
alter table public.integration_normalized_records
  add column if not exists mapped_account_id uuid,
  add column if not exists mapping_version text,
  add column if not exists mapping_status text not null default 'unmapped',
  add column if not exists mapping_message text;

alter table public.integration_normalized_records
  drop constraint if exists integration_normalized_records_mapping_status_check;
alter table public.integration_normalized_records
  add constraint integration_normalized_records_mapping_status_check
  check (mapping_status in ('unmapped','mapped','needs_review','rejected'));

create index if not exists idx_integration_normalized_mapping
  on public.integration_normalized_records (organization_id, data_source_id, mapping_status);

create or replace function public.apply_integration_account_mappings(
  p_data_source_id uuid,
  p_sync_run_id uuid default null,
  p_mapping_version text default 'v1'
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_org uuid; v_total integer:=0; v_mapped integer:=0; v_review integer:=0;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select organization_id into v_org from public.data_sources where id=p_data_source_id;
 if v_org is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
 if not public.has_org_permission(v_org,'mapping.edit') and not public.has_org_permission(v_org,'mapping.create') and not public.has_org_permission(v_org,'admin') then raise exception 'Mapping permission required'; end if;
 select count(*) into v_total from public.integration_normalized_records r where r.data_source_id=p_data_source_id and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id);
 update public.integration_normalized_records r set mapped_account_id=m.target_account_id,mapping_version=p_mapping_version,mapping_status='mapped',mapping_message=null,updated_at=now()
 from public.account_mappings m where r.data_source_id=p_data_source_id and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id) and m.organization_id=v_org and m.mapping_version=p_mapping_version and m.status='approved' and btrim(coalesce(nullif(r.account_external_id,''),nullif(r.account_code,'')))=btrim(m.source_code);
 get diagnostics v_mapped=row_count;
 update public.integration_normalized_records r set mapped_account_id=null,mapping_version=p_mapping_version,mapping_status=case when r.normalization_status='rejected' then 'rejected' else 'needs_review' end,mapping_message=case when r.normalization_status='rejected' then coalesce(r.normalization_message,'Normalization rejected') when nullif(btrim(coalesce(r.account_external_id,r.account_code,r.account_name)), '') is null then 'No source account identifier is available; manual accounting classification is required.' else 'No approved account mapping exists for this source account.' end,updated_at=now()
 where r.data_source_id=p_data_source_id and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id) and not exists (select 1 from public.account_mappings m where m.organization_id=v_org and m.mapping_version=p_mapping_version and m.status='approved' and btrim(m.source_code)=btrim(coalesce(nullif(r.account_external_id,''),nullif(r.account_code,''))));
 get diagnostics v_review=row_count;
 return jsonb_build_object('data_source_id',p_data_source_id,'sync_run_id',p_sync_run_id,'mapping_version',p_mapping_version,'total',v_total,'mapped',v_mapped,'needs_review',v_review);
end; $$;
revoke all on function public.apply_integration_account_mappings(uuid,uuid,text) from public;
grant execute on function public.apply_integration_account_mappings(uuid,uuid,text) to authenticated;
