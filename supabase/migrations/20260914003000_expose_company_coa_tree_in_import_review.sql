create or replace function public.get_import_review(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid()); v_org uuid; v_import jsonb; v_reconciliation jsonb; v_audit jsonb; v_sources jsonb; v_accounts jsonb; v_mappings jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_import_id is null then raise exception 'Import ID is required'; end if;
  select i.organization_id into v_org from public.imports i where i.id=p_import_id;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org,'screen.data.view') or not public.has_org_permission(v_org,'import.view') then raise exception 'Import view permission required'; end if;
  select jsonb_build_object('id',i.id,'organization_id',i.organization_id,'input_type',i.input_type,'file_name',i.file_name,'file_hash',i.file_hash,'status',i.status,'row_count',i.row_count,'imported_row_count',i.imported_row_count,'error_count',i.error_count,'warning_count',i.warning_count,'mapping_version',i.mapping_version,'created_at',i.created_at,'published_at',i.published_at,'published_by',i.published_by) into v_import from public.imports i where i.id=p_import_id;
  select coalesce((select jsonb_agg(to_jsonb(r) order by r.updated_at desc) from public.import_reconciliations r where r.import_id=p_import_id and r.organization_id=v_org),'[]'::jsonb) into v_reconciliation;
  select coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'from_status',e.from_status,'to_status',e.to_status,'actor_id',e.actor_id,'metadata',e.metadata,'created_at',e.created_at) order by e.created_at desc) from public.import_audit_events e where e.import_id=p_import_id and e.organization_id=v_org),'[]'::jsonb) into v_audit;
  select coalesce((select jsonb_agg(jsonb_build_object('source_code',s.source_code,'source_name',s.source_name,'row_count',s.row_count,'mapping_id',m.id,'mapping_status',m.status,'mapping_created_by',m.created_by,'mapping_approved_by',m.approved_by,'can_approve_mapping',case when m.id is not null and m.status in ('draft','rejected') and m.created_by<>v_user and public.has_org_permission(v_org,'mapping.approve') then true else false end,'target_account_id',m.target_account_id,'target_account_code',a.code,'target_account_name',a.name) order by s.source_code) from (select r.payload->>'account_code' source_code,max(r.payload->>'account_name') source_name,count(*)::integer row_count from public.import_rows r where r.import_id=p_import_id group by r.payload->>'account_code' order by count(*) desc limit 500) s left join public.account_mappings m on m.organization_id=v_org and m.mapping_version=coalesce((v_import->>'mapping_version'),'v1') and m.source_code=s.source_code left join public.accounts a on a.id=m.target_account_id and a.organization_id=v_org),'[]'::jsonb) into v_sources;
  select coalesce((select jsonb_agg(to_jsonb(x) order by x.path_code,x.code) from (with recursive tree as (select a.*,1 as level, a.code::text as path_code from public.accounts a where a.organization_id=v_org and a.parent_account_id is null union all select a.*,t.level+1, t.path_code||' / '||a.code from public.accounts a join tree t on a.parent_account_id=t.id where a.organization_id=v_org and t.level<6) select id,code,name,account_type,statement_type,statement_section,parent_account_id,level,path_code from tree) x),'[]'::jsonb) into v_accounts;
  select coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'mapping_version',m.mapping_version,'source_code',m.source_code,'source_name',m.source_name,'target_account_id',m.target_account_id,'status',m.status,'created_by',m.created_by,'approved_by',m.approved_by,'approved_at',m.approved_at) order by m.mapping_version,m.source_code) from public.account_mappings m where m.organization_id=v_org and (m.mapping_version=coalesce((v_import->>'mapping_version'),'v1') or m.status='draft') limit 1000),'[]'::jsonb) into v_mappings;
  return jsonb_build_object('import',v_import,'reconciliation',v_reconciliation,'audit_events',v_audit,'sources',v_sources,'accounts',v_accounts,'mappings',v_mappings);
end;
$function$;
