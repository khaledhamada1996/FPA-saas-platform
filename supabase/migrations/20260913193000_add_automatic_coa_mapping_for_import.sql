create or replace function public.auto_map_import_accounts(p_import_id uuid,p_mapping_version text default 'v1') returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_status text;
  v_created integer := 0;
  v_existing integer := 0;
  v_missing integer := 0;
  v_matched integer := 0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_import_id is null then raise exception 'Import ID is required'; end if;
  if p_mapping_version is null or btrim(p_mapping_version)='' then raise exception 'Mapping version is required'; end if;
  select organization_id,status into v_org,v_status from public.imports where id=p_import_id for update;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org,'mapping.create') and not public.has_org_permission(v_org,'mapping.edit') then raise exception 'Mapping create or edit permission required'; end if;
  if v_status not in ('mapping_required','validated') then raise exception 'Import cannot be auto-mapped from status %',v_status; end if;
  with source_accounts as (
    select distinct btrim(r.payload->>'account_code') source_code,btrim(r.payload->>'account_name') source_name
    from public.import_rows r where r.import_id=p_import_id and r.validation_status='valid'
  ), matches as (
    select s.source_code,s.source_name,a.id target_id,
           row_number() over(partition by s.source_code order by case when btrim(a.code)=s.source_code then 0 else 1 end,a.id) rn
    from source_accounts s
    join public.accounts a on a.organization_id=v_org
      and (btrim(a.code)=s.source_code or lower(btrim(a.name))=lower(s.source_name))
  ), chosen as (
    select source_code,source_name,target_id from matches where rn=1
  ), inserted as (
    insert into public.account_mappings(organization_id,mapping_version,source_code,source_name,target_account_id,status,created_by)
    select v_org,btrim(p_mapping_version),c.source_code,c.source_name,c.target_id,'draft',v_user
    from chosen c
    where not exists(
      select 1 from public.account_mappings m
      where m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.source_code=c.source_code
    )
    returning 1
  ) select count(*) into v_created from inserted;
  select count(*) into v_existing
  from public.account_mappings m
  where m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version)
    and exists(select 1 from public.import_rows r where r.import_id=p_import_id and btrim(r.payload->>'account_code')=m.source_code);
  select count(*) into v_matched
  from (
    select distinct btrim(r.payload->>'account_code') source_code
    from public.import_rows r
    join public.accounts a on a.organization_id=v_org
      and (btrim(a.code)=btrim(r.payload->>'account_code') or lower(btrim(a.name))=lower(btrim(r.payload->>'account_name')))
    where r.import_id=p_import_id and r.validation_status='valid'
  ) x;
  select count(*) into v_missing
  from (
    select distinct btrim(r.payload->>'account_code') source_code
    from public.import_rows r where r.import_id=p_import_id and r.validation_status='valid'
  ) s
  where not exists(
    select 1 from public.account_mappings m
    where m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.source_code=s.source_code
  );
  perform public.write_audit_event(v_org,'mapping.auto_match','import',p_import_id::text,null,
    jsonb_build_object('mapping_version',btrim(p_mapping_version),'created_count',v_created,'matched_count',v_matched,'missing_count',v_missing));
  return jsonb_build_object('import_id',p_import_id,'mapping_version',btrim(p_mapping_version),'created_count',v_created,'existing_count',v_existing,'matched_count',v_matched,'missing_count',v_missing);
end;
$function$;

revoke all on function public.auto_map_import_accounts(uuid,text) from public,anon;
grant execute on function public.auto_map_import_accounts(uuid,text) to authenticated;
