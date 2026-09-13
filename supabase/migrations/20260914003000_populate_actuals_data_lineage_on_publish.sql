CREATE OR REPLACE FUNCTION public.publish_actuals_from_import(p_import_id uuid, p_mapping_version text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_status text;
  v_mapping text;
  v_batch_id uuid;
  v_rows integer;
  v_bad integer;
  v_existing uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_import_id is null then raise exception 'Import ID is required'; end if;
  select organization_id,status,mapping_version into v_org,v_status,v_mapping from public.imports where id=p_import_id for update;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org,'actuals.publish') then raise exception 'Actuals publish permission required'; end if;
  if not public.has_org_permission(v_org,'mapping.view') then raise exception 'Mapping view permission required'; end if;
  if p_mapping_version is null or btrim(p_mapping_version)='' then raise exception 'Mapping version is required'; end if;
  if v_status not in ('ready_for_review','reconciled') then raise exception 'Import is not ready for publishing'; end if;
  if v_mapping is null or btrim(v_mapping)<>btrim(p_mapping_version) then raise exception 'Mapping version mismatch'; end if;
  if exists(select 1 from public.actuals_publish_batches b where b.import_id=p_import_id and b.organization_id=v_org and b.status='published') then
    select b.id into v_existing from public.actuals_publish_batches b where b.import_id=p_import_id and b.organization_id=v_org and b.status='published' order by b.published_at desc limit 1;
    return v_existing;
  end if;
  select count(*),count(*) filter(where validation_status<>'valid') into v_rows,v_bad from public.import_rows where import_id=p_import_id;
  if v_rows=0 or v_bad>0 then raise exception 'Import contains invalid rows'; end if;
  if exists(select 1 from public.import_rows r left join public.account_mappings m on m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.source_code=(r.payload->>'account_code') and m.status='approved' where r.import_id=p_import_id and m.id is null) then raise exception 'Approved mapping coverage is incomplete'; end if;
  insert into public.actuals_publish_batches(organization_id,import_id,mapping_version,status,published_by,published_at) values(v_org,p_import_id,btrim(p_mapping_version),'published',v_user,now()) returning id into v_batch_id;
  update public.financial_facts old_fact set fact_type='actual_superseded',superseded_by=v_batch_id,superseded_at=now() where old_fact.organization_id=v_org and old_fact.fact_type='actual' and old_fact.journal_no is not null and old_fact.journal_no in (select distinct r.payload->>'journal_no' from public.import_rows r where r.import_id=p_import_id and nullif(btrim(r.payload->>'journal_no'),'') is not null);
  insert into public.financial_facts(organization_id,source_import_id,source_batch_id,fact_type,financial_date,account_id,amount_minor,description,created_by,journal_no,debit_minor,credit_minor,source_row_key,version_no,record_hash)
  select v_org,p_import_id,v_batch_id,'actual',(r.payload->>'date')::date,m.target_account_id,round(((coalesce(nullif(r.payload->>'debit','')::numeric,0)-coalesce(nullif(r.payload->>'credit','')::numeric,0))*100))::bigint,r.payload->>'description',v_user,r.payload->>'journal_no',round(coalesce(nullif(r.payload->>'debit','')::numeric,0)*100)::bigint,round(coalesce(nullif(r.payload->>'credit','')::numeric,0)*100)::bigint,coalesce(nullif(r.source_key,''),r.row_number::text),coalesce((select max(f.version_no)+1 from public.financial_facts f where f.organization_id=v_org and f.journal_no=r.payload->>'journal_no'),1),encode(extensions.digest(convert_to(r.payload::text,'UTF8'),'sha256'),'hex')
  from public.import_rows r join public.account_mappings m on m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.source_code=(r.payload->>'account_code') and m.status='approved' where r.import_id=p_import_id;
  insert into public.data_lineage(organization_id,source_record_key,source_entity_type,normalized_entity_type,normalized_record_id,source_reference,mapping_version,observed_at)
  select v_org,coalesce(nullif(r.source_key,''),r.row_number::text),'import_row','financial_fact',f.id,'import:'||p_import_id::text,btrim(p_mapping_version),now()
  from public.import_rows r join public.financial_facts f on f.organization_id=v_org and f.source_import_id=p_import_id and f.source_row_key=coalesce(nullif(r.source_key,''),r.row_number::text) and f.source_batch_id=v_batch_id where r.import_id=p_import_id;
  update public.imports set status='published',published_at=now(),published_by=v_user,imported_row_count=v_rows where id=p_import_id;
  perform public.write_audit_event(v_org,'actuals.publish','import',p_import_id::text,null,jsonb_build_object('batch_id',v_batch_id,'mapping_version',btrim(p_mapping_version),'row_count',v_rows,'versioning','journal_no_supersedes_previous','lineage','import_row_to_financial_fact'));
  return v_batch_id;
end;
$function$;

revoke all on function public.publish_actuals_from_import(uuid,text) from public;
revoke all on function public.publish_actuals_from_import(uuid,text) from anon;
grant execute on function public.publish_actuals_from_import(uuid,text) to authenticated;
