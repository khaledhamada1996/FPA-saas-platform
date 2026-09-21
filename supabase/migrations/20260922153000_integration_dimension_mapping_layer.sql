create table if not exists public.integration_dimension_mappings (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 data_source_id uuid not null references public.data_sources(id) on delete cascade, source_dimension text not null, source_value text not null,
 target_dimension_type text not null, target_id uuid not null, status text not null default 'draft',
 created_by uuid references auth.users(id), approved_by uuid references auth.users(id), approved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint integration_dimension_mappings_status_check check(status in ('draft','approved','rejected')),
 constraint integration_dimension_mappings_target_type_check check(target_dimension_type in ('legal_entity','branch','department','cost_center','region','product','project')),
 unique(data_source_id,source_dimension,source_value)
);
alter table public.integration_normalized_records add column if not exists mapped_dimensions jsonb not null default '{}'::jsonb, add column if not exists dimension_mapping_status text not null default 'unmapped', add column if not exists dimension_mapping_message text;
alter table public.integration_normalized_records drop constraint if exists integration_normalized_records_dimension_mapping_status_check;
alter table public.integration_normalized_records add constraint integration_normalized_records_dimension_mapping_status_check check(dimension_mapping_status in ('unmapped','mapped','needs_review','rejected'));
create index if not exists idx_integration_dim_map_lookup on public.integration_dimension_mappings(data_source_id,source_dimension,source_value,status);
create index if not exists idx_integration_normalized_dim_status on public.integration_normalized_records(organization_id,data_source_id,dimension_mapping_status);
alter table public.integration_dimension_mappings enable row level security;
drop policy if exists integration_dimension_mappings_select on public.integration_dimension_mappings;
create policy integration_dimension_mappings_select on public.integration_dimension_mappings for select to authenticated using(public.has_org_permission(organization_id,'mapping.view') or public.has_org_permission(organization_id,'view') or public.has_org_permission(organization_id,'admin'));
drop policy if exists integration_dimension_mappings_modify on public.integration_dimension_mappings;
create policy integration_dimension_mappings_modify on public.integration_dimension_mappings for all to authenticated using(public.has_org_permission(organization_id,'mapping.edit') or public.has_org_permission(organization_id,'mapping.create') or public.has_org_permission(organization_id,'admin')) with check(public.has_org_permission(organization_id,'mapping.edit') or public.has_org_permission(organization_id,'mapping.create') or public.has_org_permission(organization_id,'admin'));

create or replace function public.upsert_integration_dimension_mapping(p_data_source_id uuid,p_source_dimension text,p_source_value text,p_target_dimension_type text,p_target_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_org uuid; v_id uuid; v_valid boolean:=false;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select organization_id into v_org from public.data_sources where id=p_data_source_id;
 if v_org is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
 if not public.has_org_permission(v_org,'mapping.create') and not public.has_org_permission(v_org,'mapping.edit') and not public.has_org_permission(v_org,'admin') then raise exception 'Mapping permission required'; end if;
 if nullif(btrim(p_source_dimension),'') is null or nullif(btrim(p_source_value),'') is null then raise exception 'SOURCE_DIMENSION_AND_VALUE_REQUIRED'; end if;
 if p_target_dimension_type not in ('legal_entity','branch','department','cost_center','region','product','project') then raise exception 'UNSUPPORTED_TARGET_DIMENSION'; end if;
 if p_target_dimension_type='legal_entity' then select exists(select 1 from public.legal_entities where id=p_target_id and organization_id=v_org) into v_valid;
 elsif p_target_dimension_type='branch' then select exists(select 1 from public.branches where id=p_target_id and organization_id=v_org) into v_valid;
 elsif p_target_dimension_type='department' then select exists(select 1 from public.departments where id=p_target_id and organization_id=v_org) into v_valid;
 elsif p_target_dimension_type='cost_center' then select exists(select 1 from public.cost_centers where id=p_target_id and organization_id=v_org) into v_valid;
 elsif p_target_dimension_type='region' then select exists(select 1 from public.regions where id=p_target_id and organization_id=v_org) into v_valid;
 elsif p_target_dimension_type='product' then select exists(select 1 from public.products where id=p_target_id and organization_id=v_org) into v_valid;
 elsif p_target_dimension_type='project' then select exists(select 1 from public.projects where id=p_target_id and organization_id=v_org) into v_valid;
 end if;
 if not v_valid then raise exception 'INVALID_TARGET_DIMENSION'; end if;
 insert into public.integration_dimension_mappings(organization_id,data_source_id,source_dimension,source_value,target_dimension_type,target_id,status,created_by,updated_at)
 values(v_org,p_data_source_id,btrim(p_source_dimension),btrim(p_source_value),p_target_dimension_type,p_target_id,'draft',v_uid,now())
 on conflict(data_source_id,source_dimension,source_value) do update set target_dimension_type=excluded.target_dimension_type,target_id=excluded.target_id,status='draft',created_by=v_uid,approved_by=null,approved_at=null,updated_at=now()
 returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.upsert_integration_dimension_mapping(uuid,text,text,text,uuid) from public;
grant execute on function public.upsert_integration_dimension_mapping(uuid,text,text,text,uuid) to authenticated;

create or replace function public.review_integration_dimension_mapping(p_mapping_id uuid,p_action text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_org uuid; v_creator uuid;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select organization_id,created_by into v_org,v_creator from public.integration_dimension_mappings where id=p_mapping_id for update;
 if v_org is null then raise exception 'MAPPING_NOT_FOUND'; end if;
 if not public.has_org_permission(v_org,'mapping.approve') and not public.has_org_permission(v_org,'admin') then raise exception 'Mapping approval permission required'; end if;
 if p_action not in ('approve','reject') then raise exception 'INVALID_REVIEW_ACTION'; end if;
 if p_action='approve' and v_creator=v_uid then raise exception 'A preparer cannot approve their own mapping'; end if;
 if p_action='approve' then update public.integration_dimension_mappings set status='approved',approved_by=v_uid,approved_at=now(),updated_at=now() where id=p_mapping_id;
 else update public.integration_dimension_mappings set status='rejected',approved_by=null,approved_at=null,updated_at=now() where id=p_mapping_id; end if;
 return p_mapping_id;
end; $$;
revoke all on function public.review_integration_dimension_mapping(uuid,text) from public;
grant execute on function public.review_integration_dimension_mapping(uuid,text) to authenticated;

create or replace function public.apply_integration_dimension_mappings(p_data_source_id uuid,p_sync_run_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_org uuid; v_total int:=0; v_mapped int:=0; v_review int:=0;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select organization_id into v_org from public.data_sources where id=p_data_source_id;
 if v_org is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
 if not public.has_org_permission(v_org,'mapping.edit') and not public.has_org_permission(v_org,'mapping.create') and not public.has_org_permission(v_org,'admin') then raise exception 'Mapping permission required'; end if;
 select count(*) into v_total from public.integration_normalized_records r where r.data_source_id=p_data_source_id and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id);
 update public.integration_normalized_records r set mapped_dimensions=coalesce((select jsonb_object_agg(m.source_dimension,jsonb_build_object('target_dimension_type',m.target_dimension_type,'target_id',m.target_id)) from public.integration_dimension_mappings m where m.data_source_id=r.data_source_id and m.status='approved' and r.dimensions ? m.source_dimension and btrim(case when jsonb_typeof(r.dimensions->m.source_dimension)='string' then r.dimensions->>m.source_dimension else r.dimensions->m.source_dimension #>> '{}' end)=btrim(m.source_value)),'{}'::jsonb), dimension_mapping_status='mapped',dimension_mapping_message=null,updated_at=now()
 where r.data_source_id=p_data_source_id and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id);
 get diagnostics v_mapped=row_count;
 update public.integration_normalized_records r set dimension_mapping_status=case when r.normalization_status='rejected' then 'rejected' else 'needs_review' end,dimension_mapping_message='One or more source dimensions have no approved integration mapping.',updated_at=now()
 where r.data_source_id=p_data_source_id and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id) and jsonb_typeof(r.dimensions)='object' and exists(select 1 from jsonb_object_keys(r.dimensions) k where not exists(select 1 from public.integration_dimension_mappings m where m.data_source_id=r.data_source_id and m.status='approved' and m.source_dimension=k and btrim(case when jsonb_typeof(r.dimensions->k)='string' then r.dimensions->>k else r.dimensions->k #>> '{}' end)=btrim(m.source_value)));
 get diagnostics v_review=row_count;
 return jsonb_build_object('data_source_id',p_data_source_id,'sync_run_id',p_sync_run_id,'total',v_total,'mapped',v_mapped,'needs_review',v_review);
end; $$;
revoke all on function public.apply_integration_dimension_mappings(uuid,uuid) from public;
grant execute on function public.apply_integration_dimension_mappings(uuid,uuid) to authenticated;