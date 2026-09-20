-- Harden the Actuals publish boundary so the database enforces the same workflow
-- required by the UI: successful reconciliation + actuals.publish permission.

create or replace function public.publish_actuals_from_import(p_import_id uuid, p_mapping_version text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
 v_user uuid := (select auth.uid());
 v_org uuid; v_batch uuid; v_rows integer; v_bad integer; v_status text; v_currency text;
 v_unresolved integer; v_locked integer; v_recon_status text; v_recon_mapping text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_import_id is null then raise exception 'Import is required'; end if;
 if nullif(btrim(p_mapping_version),'') is null then raise exception 'Mapping version is required'; end if;
 select i.organization_id,i.status into v_org,v_status from public.imports i where i.id=p_import_id for update;
 if v_org is null then raise exception 'Import not found'; end if;
 if not public.has_org_permission(v_org,'actuals.publish') then raise exception 'Actuals publish permission required for this organization'; end if;
 if v_status <> 'reconciled' then raise exception 'Import must be reconciled successfully before Actuals can be published'; end if;

 select r.status,r.mapping_version into v_recon_status,v_recon_mapping
 from public.import_reconciliations r
 where r.import_id=p_import_id order by r.updated_at desc limit 1 for update;
 if v_recon_status <> 'passed' then raise exception 'Import reconciliation must be passed before Actuals can be published'; end if;
 if btrim(coalesce(v_recon_mapping,'')) <> btrim(p_mapping_version) then raise exception 'Publish mapping version does not match the passed reconciliation'; end if;

 select count(*)::integer into v_rows from public.import_rows where import_id=p_import_id and validation_status='valid';
 select count(*)::integer into v_bad from public.import_rows where import_id=p_import_id and validation_status in ('pending','warning','error');
 if v_rows=0 or v_bad>0 then raise exception 'Import contains rows that are not valid'; end if;

 if exists(select 1 from public.import_rows ir where ir.import_id=p_import_id and not exists(
   select 1 from public.account_mappings m where m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version)
   and m.source_code=(ir.payload->>'account_code') and m.status='approved')) then
   raise exception 'Every account must have an approved mapping';
 end if;

 with vals as (
   select 'legal_entity' dimension_type,nullif(btrim(payload->>'legal_entity'),'') source_value from public.import_rows where import_id=p_import_id and validation_status='valid'
   union all select 'branch',nullif(btrim(payload->>'branch'),'') from public.import_rows where import_id=p_import_id and validation_status='valid'
   union all select 'department',nullif(btrim(payload->>'department'),'') from public.import_rows where import_id=p_import_id and validation_status='valid'
   union all select 'cost_center',nullif(btrim(payload->>'cost_center'),'') from public.import_rows where import_id=p_import_id and validation_status='valid'
   union all select 'region',nullif(btrim(payload->>'region'),'') from public.import_rows where import_id=p_import_id and validation_status='valid'
   union all select 'product',nullif(btrim(payload->>'product'),'') from public.import_rows where import_id=p_import_id and validation_status='valid'
   union all select 'project',nullif(btrim(payload->>'project'),'') from public.import_rows where import_id=p_import_id and validation_status='valid'
 ), needed as (select distinct dimension_type,source_value from vals where source_value is not null)
 select count(*) into v_unresolved from needed n where not exists(
   select 1 from public.import_dimension_mappings dm where dm.import_id=p_import_id and dm.organization_id=v_org
   and dm.dimension_type=n.dimension_type and lower(btrim(dm.source_value))=lower(btrim(n.source_value)) and dm.status='approved');
 if v_unresolved>0 then raise exception 'Import contains % dimension values without approved mappings; map and approve them before publish',v_unresolved; end if;

 with periods as (select distinct date_trunc('month',(payload->>'date')::date)::date period_start from public.import_rows where import_id=p_import_id and validation_status='valid')
 select count(*) into v_locked from periods p join public.financial_periods fp on fp.organization_id=v_org and fp.period_start=p.period_start and fp.status='locked';
 if v_locked>0 then raise exception 'IMPORT_PERIOD_LOCKED: import contains transactions for % locked financial periods',v_locked; end if;

 select base_currency into v_currency from public.organizations where id=v_org;

 insert into public.financial_periods(organization_id,period_start,period_end,status)
 select v_org,m.period_start,(m.period_start+interval '1 month - 1 day')::date,'open'
 from (select distinct date_trunc('month',(payload->>'date')::date)::date period_start from public.import_rows where import_id=p_import_id and validation_status='valid') m
 on conflict(organization_id,period_start) do nothing;

 insert into public.financial_facts(
   organization_id,financial_period_id,account_id,legal_entity_id,branch_id,department_id,cost_center_id,region_id,product_id,project_id,
   currency,amount_minor,fact_type,source_import_id,source_row_key,journal_no,description,debit_minor,credit_minor,transaction_date,status)
 select ir.organization_id,fp.id,am.target_account_id,le.target_id,br.target_id,dep.target_id,cc.target_id,rg.target_id,pr.target_id,pj.target_id,
   v_currency,
   round(coalesce(nullif(ir.payload->>'debit','')::numeric,0)*100)::bigint-round(coalesce(nullif(ir.payload->>'credit','')::numeric,0)*100)::bigint,
   'actual',p_import_id,ir.source_key,ir.payload->>'journal_no',ir.payload->>'description',
   round(coalesce(nullif(ir.payload->>'debit','')::numeric,0)*100)::bigint,
   round(coalesce(nullif(ir.payload->>'credit','')::numeric,0)*100)::bigint,
   (ir.payload->>'date')::date,'published'
 from public.import_rows ir
 join public.account_mappings am on am.organization_id=v_org and am.mapping_version=btrim(p_mapping_version)
   and am.source_code=(ir.payload->>'account_code') and am.status='approved'
 join public.financial_periods fp on fp.organization_id=v_org and fp.period_start=date_trunc('month',(ir.payload->>'date')::date)::date
 left join public.import_dimension_mappings le on le.import_id=p_import_id and le.organization_id=v_org and le.dimension_type='legal_entity' and lower(btrim(le.source_value))=lower(btrim(ir.payload->>'legal_entity')) and le.status='approved'
 left join public.import_dimension_mappings br on br.import_id=p_import_id and br.organization_id=v_org and br.dimension_type='branch' and lower(btrim(br.source_value))=lower(btrim(ir.payload->>'branch')) and br.status='approved'
 left join public.import_dimension_mappings dep on dep.import_id=p_import_id and dep.organization_id=v_org and dep.dimension_type='department' and lower(btrim(dep.source_value))=lower(btrim(ir.payload->>'department')) and dep.status='approved'
 left join public.import_dimension_mappings cc on cc.import_id=p_import_id and cc.organization_id=v_org and cc.dimension_type='cost_center' and lower(btrim(cc.source_value))=lower(btrim(ir.payload->>'cost_center')) and cc.status='approved'
 left join public.import_dimension_mappings rg on rg.import_id=p_import_id and rg.organization_id=v_org and rg.dimension_type='region' and lower(btrim(rg.source_value))=lower(btrim(ir.payload->>'region')) and rg.status='approved'
 left join public.import_dimension_mappings pr on pr.import_id=p_import_id and pr.organization_id=v_org and pr.dimension_type='product' and lower(btrim(pr.source_value))=lower(btrim(ir.payload->>'product')) and pr.status='approved'
 left join public.import_dimension_mappings pj on pj.import_id=p_import_id and pj.organization_id=v_org and pj.dimension_type='project' and lower(btrim(pj.source_value))=lower(btrim(ir.payload->>'project')) and pj.status='approved'
 where ir.import_id=p_import_id and ir.validation_status='valid';

 insert into public.actuals_publish_batches(organization_id,import_id,mapping_version,status,row_count,published_at,published_by)
 values(v_org,p_import_id,btrim(p_mapping_version),'published',v_rows,now(),v_user) returning id into v_batch;

 update public.imports set status='published',imported_row_count=v_rows,published_at=now(),mapping_version=btrim(p_mapping_version),published_by=v_user where id=p_import_id;

 insert into public.data_lineage(organization_id,data_source_id,sync_run_id,source_record_key,source_entity_type,normalized_entity_type,normalized_record_id,source_reference,mapping_version,observed_at)
 select v_org,null,null,ff.source_row_key,'actual_journal_transaction','financial_fact',ff.id,i.file_name,btrim(p_mapping_version),now()
 from public.financial_facts ff join public.imports i on i.id=ff.source_import_id
 where ff.source_import_id=p_import_id and ff.status='published';

 insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata)
 values(v_org,p_import_id,v_user,'publish',v_status,'published',
   jsonb_build_object('row_count',v_rows,'mapping_version',btrim(p_mapping_version),'dimensions_resolved',true,
   'dimension_mapping_source','approved_import_dimension_mappings','lineage_recorded',true,'reconciliation_required',true));
 return v_batch;
end;
$function$;

revoke all on function public.publish_actuals_from_import(uuid,text) from public, anon;
grant execute on function public.publish_actuals_from_import(uuid,text) to authenticated;
