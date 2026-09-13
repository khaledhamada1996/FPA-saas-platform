create or replace function public.validate_account_mapping_approval_audit() returns trigger language plpgsql set search_path='public','pg_temp' as $function$
begin
  if new.status='approved' then
    if new.created_by is null then
      if new.approved_at is null then raise exception 'System-approved mapping requires approved_at'; end if;
    else
      if new.approved_by is null or new.approved_at is null then raise exception 'Approved mapping requires approved_by and approved_at'; end if;
    end if;
  end if;
  if new.status='rejected' then
    if new.rejected_by is null or new.rejected_at is null then raise exception 'Rejected mapping requires rejected_by and rejected_at'; end if;
  end if;
  if tg_op='UPDATE' and old.status='approved' then
    if new.status<>'approved' then raise exception 'Approved mappings cannot be changed directly'; end if;
    if new.target_account_id is distinct from old.target_account_id or new.organization_id is distinct from old.organization_id or new.source_code is distinct from old.source_code or new.source_name is distinct from old.source_name then raise exception 'Approved mapping is immutable'; end if;
  end if;
  return new;
end;
$function$;

create or replace function public.auto_map_import_accounts(p_import_id uuid,p_mapping_version text default 'v1') returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=(select auth.uid()); v_org uuid; v_status text; v_created integer:=0; v_missing integer:=0; v_matched integer:=0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_import_id is null then raise exception 'Import ID is required'; end if;
  if p_mapping_version is null or btrim(p_mapping_version)='' then raise exception 'Mapping version is required'; end if;
  select organization_id,status into v_org,v_status from public.imports where id=p_import_id for update;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org,'import.create') and not public.has_org_permission(v_org,'mapping.create') and not public.has_org_permission(v_org,'mapping.edit') then raise exception 'Import or mapping permission required'; end if;
  if v_status not in ('mapping_required','validated') then raise exception 'Import cannot be auto-mapped from status %',v_status; end if;
  with source_accounts as (select distinct btrim(r.payload->>'account_code') source_code,btrim(r.payload->>'account_name') source_name from public.import_rows r where r.import_id=p_import_id and r.validation_status='valid'), candidates as (select s.source_code,s.source_name,a.id target_id,count(*) over(partition by s.source_code) candidate_count,case when btrim(a.code)=s.source_code then 0 else 1 end match_rank from source_accounts s join public.accounts a on a.organization_id=v_org and (btrim(a.code)=s.source_code or lower(btrim(a.name))=lower(s.source_name))), chosen as (select source_code,source_name,target_id from candidates where candidate_count=1 order by match_rank), inserted as (insert into public.account_mappings(organization_id,mapping_version,source_code,source_name,target_account_id,status,created_by,approved_by,approved_at) select v_org,btrim(p_mapping_version),c.source_code,c.source_name,c.target_id,'approved',null,null,now() from chosen c where not exists(select 1 from public.account_mappings m where m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.source_code=c.source_code) returning 1) select count(*) into v_created from inserted;
  select count(*) into v_matched from (select distinct btrim(r.payload->>'account_code') source_code from public.import_rows r join public.accounts a on a.organization_id=v_org and (btrim(a.code)=btrim(r.payload->>'account_code') or lower(btrim(a.name))=lower(btrim(r.payload->>'account_name'))) where r.import_id=p_import_id and r.validation_status='valid') x;
  select count(*) into v_missing from (select distinct btrim(r.payload->>'account_code') source_code from public.import_rows r where r.import_id=p_import_id and r.validation_status='valid') s where not exists(select 1 from public.account_mappings m where m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.source_code=s.source_code);
  if v_created>0 then perform public.write_audit_event(v_org,'mapping.auto_match','import',p_import_id::text,null,jsonb_build_object('mapping_version',btrim(p_mapping_version),'created_count',v_created,'matched_count',v_matched,'missing_count',v_missing,'approval_mode','system_exact_match')); end if;
  return jsonb_build_object('import_id',p_import_id,'mapping_version',btrim(p_mapping_version),'created_count',v_created,'matched_count',v_matched,'missing_count',v_missing);
end; $function$;
revoke all on function public.auto_map_import_accounts(uuid,text) from public,anon;
grant execute on function public.auto_map_import_accounts(uuid,text) to authenticated;

create or replace function public.ingest_validated_import(p_organization_id uuid,p_file_name text,p_file_hash text,p_rows jsonb) returns uuid language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=(select auth.uid()); v_import_id uuid; v_existing_id uuid; v_row_count integer; v_bad_count integer; v_unbalanced_count integer;
begin
 if v_user is null then raise exception 'Authentication required'; end if; if p_organization_id is null then raise exception 'Organization is required'; end if; if not public.has_org_permission(p_organization_id,'import.create') then raise exception 'Import create permission required'; end if; if jsonb_typeof(p_rows)<>'array' then raise exception 'Rows must be a JSON array'; end if; v_row_count:=jsonb_array_length(p_rows); if v_row_count=0 then raise exception 'Import contains no rows'; end if; if v_row_count>50000 then raise exception 'Import exceeds the 50000 row limit'; end if; if nullif(trim(p_file_name),'') is null then raise exception 'File name is required'; end if;
 if p_file_hash is not null then select id into v_existing_id from public.imports where organization_id=p_organization_id and file_hash=p_file_hash order by created_at desc limit 1; if v_existing_id is not null then return v_existing_id; end if; end if;
 with parsed as (select elem,nullif(trim(elem->>'date'),'') date_text,nullif(trim(elem->>'journal_no'),'') journal_no,nullif(trim(elem->>'description'),'') description,nullif(trim(elem->>'account_code'),'') account_code,nullif(trim(elem->>'account_name'),'') account_name,case when coalesce(elem->>'debit','') ~ '^[0-9]+([.][0-9]+)?$' then (elem->>'debit')::numeric else null end debit,case when coalesce(elem->>'credit','') ~ '^[0-9]+([.][0-9]+)?$' then (elem->>'credit')::numeric else null end credit from jsonb_array_elements(p_rows) as x(elem)) select count(*) into v_bad_count from parsed where date_text is null or date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}( [0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?)?$' or journal_no is null or description is null or account_code is null or account_name is null or debit is null or credit is null or debit<0 or credit<0 or (debit>0 and credit>0) or (debit=0 and credit=0);
 if v_bad_count>0 then raise exception 'Import contains invalid rows: %',v_bad_count; end if;
 with parsed as (select elem->>'journal_no' journal_no,(elem->>'debit')::numeric debit,(elem->>'credit')::numeric credit from jsonb_array_elements(p_rows) as x(elem)), unbalanced as (select journal_no from parsed group by journal_no having abs(sum(debit)-sum(credit))>0.005) select count(*) into v_unbalanced_count from unbalanced; if v_unbalanced_count>0 then raise exception 'Import contains % unbalanced journal entries',v_unbalanced_count; end if;
 insert into public.imports(organization_id,file_name,file_hash,input_type,status,row_count,imported_row_count,error_count,warning_count,created_by) values(p_organization_id,trim(p_file_name),p_file_hash,'actual_journal_transactions','mapping_required',v_row_count,0,0,0,v_user) returning id into v_import_id;
 insert into public.import_rows(import_id,organization_id,row_number,source_key,payload,validation_status,validation_message) select v_import_id,p_organization_id,ordinality::integer,coalesce(nullif(elem->>'source_key',''),coalesce(p_file_hash,'no-hash')||':'||ordinality::text),elem-'source_key','valid',null from jsonb_array_elements(p_rows) with ordinality as x(elem,ordinality);
 perform public.auto_map_import_accounts(v_import_id,'v1');
 insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata) values(p_organization_id,v_import_id,v_user,'ingest',null,'mapping_required',jsonb_build_object('row_count',v_row_count,'file_name',trim(p_file_name),'input_type','actual_journal_transactions'));
 return v_import_id;
end; $function$;
revoke all on function public.ingest_validated_import(uuid,text,text,jsonb) from public,anon;
grant execute on function public.ingest_validated_import(uuid,text,text,jsonb) to authenticated;
