alter table public.data_sources add column if not exists legal_entity_id uuid references public.legal_entities(id) on delete set null;
create index if not exists idx_data_sources_legal_entity on public.data_sources(organization_id,legal_entity_id);
create or replace function public.manage_data_source(
 p_organization_id uuid,
 p_data_source_id uuid default null,
 p_action text default 'create',
 p_source_type text default null,
 p_system_name text default null,
 p_connection_key text default null,
 p_sync_mode text default 'manual',
 p_legal_entity_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare v_id uuid;
begin
 if not public.has_org_permission(p_organization_id,'data_source.manage') then raise exception 'PERMISSION_DENIED'; end if;
 if p_action='create' then
   if p_source_type not in ('manual','excel_csv','integration','api','database','other') then raise exception 'INVALID_SOURCE_TYPE'; end if;
   if p_sync_mode not in ('manual','scheduled','near_real_time','real_time') then raise exception 'INVALID_SYNC_MODE'; end if;
   if p_legal_entity_id is not null and not exists(select 1 from public.legal_entities le where le.id=p_legal_entity_id and le.organization_id=p_organization_id) then raise exception 'INVALID_LEGAL_ENTITY'; end if;
   insert into public.data_sources(organization_id,source_type,system_name,connection_key,status,sync_mode,created_by,legal_entity_id)
   values(p_organization_id,p_source_type,p_system_name,p_connection_key,'active',p_sync_mode,(select auth.uid()),p_legal_entity_id)
   returning id into v_id;
   return v_id;
 end if;
 if p_action='update' and p_data_source_id is not null then
   if p_legal_entity_id is not null and not exists(select 1 from public.legal_entities le where le.id=p_legal_entity_id and le.organization_id=p_organization_id) then raise exception 'INVALID_LEGAL_ENTITY'; end if;
   update public.data_sources set system_name=coalesce(p_system_name,system_name),source_type=coalesce(p_source_type,source_type),connection_key=coalesce(p_connection_key,connection_key),sync_mode=coalesce(p_sync_mode,sync_mode),legal_entity_id=p_legal_entity_id,updated_at=now()
   where id=p_data_source_id and organization_id=p_organization_id returning id into v_id;
   if v_id is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
   return v_id;
 end if;
 raise exception 'INVALID_ACTION';
end;
$function$;