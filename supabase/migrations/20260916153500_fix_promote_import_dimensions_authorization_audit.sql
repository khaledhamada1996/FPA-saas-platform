create or replace function public.promote_import_dimensions_to_master_data(p_import_id uuid, p_dimension_types text[] default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); v_org uuid; v_import record; v_type text; v_value text; v_code text; v_id uuid;
  v_created int := 0; v_reused int := 0; v_results jsonb := '[]'::jsonb;
  v_types text[] := coalesce(p_dimension_types, array['legal_entity','branch','department','cost_center','region','product','project']);
  v_legal_entity_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select i.* into v_import from public.imports i where i.id=p_import_id;
  if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
  v_org := v_import.organization_id;
  if not exists (select 1 from public.organization_members om where om.organization_id=v_org and om.user_id=v_uid) then raise exception 'ORG_ACCESS_DENIED'; end if;
  if not coalesce(public.has_org_permission(v_org,v_uid,'manage_settings'),false) then raise exception 'PERMISSION_DENIED'; end if;
  if v_import.status not in ('mapping_required','ready_for_review','reconciled','published') then raise exception 'IMPORT_STATE_NOT_SUPPORTED'; end if;
  foreach v_type in array v_types loop
    if v_type not in ('legal_entity','branch','department','cost_center','region','product','project') then raise exception 'INVALID_DIMENSION_TYPE:%',v_type; end if;
    for v_value in execute format($q$select distinct nullif(trim(payload->>%L),'') from public.import_rows where import_id=$1 and nullif(trim(payload->>%L),'') is not null order by 1$q$,v_type,v_type) using p_import_id loop
      v_id := null; v_code := upper(left(md5(v_org::text||':'||v_type||':'||lower(v_value)),12));
      if v_type='legal_entity' then
        select id into v_id from public.legal_entities where organization_id=v_org and (lower(trim(name))=lower(trim(v_value)) or lower(trim(code))=lower(trim(v_code))) limit 1;
        if v_id is null then insert into public.legal_entities(organization_id,name,code,currency) values(v_org,v_value,v_code,'SAR') returning id into v_id; v_created:=v_created+1; else v_reused:=v_reused+1; end if; v_legal_entity_id:=v_id;
      elsif v_type='branch' then
        select id into v_id from public.branches where organization_id=v_org and (lower(trim(name))=lower(trim(v_value)) or lower(trim(code))=lower(trim(v_code))) limit 1;
        if v_id is null then insert into public.branches(organization_id,name,code,legal_entity_id) values(v_org,v_value,v_code,v_legal_entity_id) returning id into v_id; v_created:=v_created+1; else v_reused:=v_reused+1; end if;
      elsif v_type='department' then
        select id into v_id from public.departments where organization_id=v_org and (lower(trim(name))=lower(trim(v_value)) or lower(trim(code))=lower(trim(v_code))) limit 1;
        if v_id is null then insert into public.departments(organization_id,name,code) values(v_org,v_value,v_code) returning id into v_id; v_created:=v_created+1; else v_reused:=v_reused+1; end if;
      elsif v_type='cost_center' then
        select id into v_id from public.cost_centers where organization_id=v_org and (lower(trim(name))=lower(trim(v_value)) or lower(trim(code))=lower(trim(v_code))) limit 1;
        if v_id is null then insert into public.cost_centers(organization_id,name,code) values(v_org,v_value,v_code) returning id into v_id; v_created:=v_created+1; else v_reused:=v_reused+1; end if;
      elsif v_type='region' then
        select id into v_id from public.regions where organization_id=v_org and (lower(trim(name))=lower(trim(v_value)) or lower(trim(code))=lower(trim(v_code))) limit 1;
        if v_id is null then insert into public.regions(organization_id,name,code) values(v_org,v_value,v_code) returning id into v_id; v_created:=v_created+1; else v_reused:=v_reused+1; end if;
      elsif v_type='product' then
        select id into v_id from public.products where organization_id=v_org and (lower(trim(name))=lower(trim(v_value)) or lower(trim(code))=lower(trim(v_code))) limit 1;
        if v_id is null then insert into public.products(organization_id,name,code) values(v_org,v_value,v_code) returning id into v_id; v_created:=v_created+1; else v_reused:=v_reused+1; end if;
      elsif v_type='project' then
        select id into v_id from public.projects where organization_id=v_org and (lower(trim(name))=lower(trim(v_value)) or lower(trim(code))=lower(trim(v_code))) limit 1;
        if v_id is null then insert into public.projects(organization_id,name,code) values(v_org,v_value,v_code) returning id into v_id; v_created:=v_created+1; else v_reused:=v_reused+1; end if;
      end if;
      insert into public.import_dimension_mappings(organization_id,import_id,dimension_type,source_value,target_id,created_by,status) values(v_org,p_import_id,v_type,v_value,v_id,v_uid,'draft') on conflict (import_id,dimension_type,lower(source_value)) do update set target_id=excluded.target_id,updated_at=now(),status='draft';
      v_results:=v_results||jsonb_build_array(jsonb_build_object('dimension_type',v_type,'source_value',v_value,'target_id',v_id));
    end loop;
  end loop;
  insert into public.audit_events(organization_id,actor_user_id,action,target_type,target_id,after_values) values(v_org,v_uid,'master_data.promoted_from_import','import',p_import_id::text,jsonb_build_object('created',v_created,'reused',v_reused,'dimension_types',v_types));
  return jsonb_build_object('created',v_created,'reused',v_reused,'mappings',v_results);
end;
$$;
grant execute on function public.promote_import_dimensions_to_master_data(uuid,text[]) to authenticated;
