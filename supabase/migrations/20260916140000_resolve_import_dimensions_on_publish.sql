create or replace function public.publish_actuals_from_import(p_import_id uuid, p_mapping_version text)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_batch uuid;
  v_rows integer;
  v_bad integer;
  v_status text;
  v_currency text;
  v_unresolved integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_import_id is null then raise exception 'Import is required'; end if;
  if nullif(trim(p_mapping_version),'') is null then raise exception 'Mapping version is required'; end if;

  select i.organization_id, i.status into v_org, v_status
  from public.imports i where i.id=p_import_id for update;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org,'approve') then raise exception 'Publish approval permission required for this organization'; end if;
  if v_status='rolled_back' then raise exception 'Rolled back imports cannot be published'; end if;
  if v_status='published' then raise exception 'Import is already published'; end if;

  select count(*)::integer into v_rows from public.import_rows ir where ir.import_id=p_import_id and ir.validation_status='valid';
  select count(*)::integer into v_bad from public.import_rows ir where ir.import_id=p_import_id and ir.validation_status in ('pending','warning','error');
  if v_rows=0 or v_bad>0 then raise exception 'Import contains rows that are not valid'; end if;

  if exists (
    select 1 from public.import_rows ir where ir.import_id=p_import_id
      and not exists (select 1 from public.account_mappings m where m.organization_id=ir.organization_id and m.mapping_version=trim(p_mapping_version) and m.source_code=(ir.payload->>'account_code') and m.status='approved')
  ) then raise exception 'Every account must have an approved mapping'; end if;

  with dimension_values as (
    select ir.row_number,'legal_entity' dimension,nullif(btrim(ir.payload->>'legal_entity'),'') value from public.import_rows ir where ir.import_id=p_import_id and ir.validation_status='valid'
    union all select ir.row_number,'branch',nullif(btrim(ir.payload->>'branch'),'') from public.import_rows ir where ir.import_id=p_import_id and ir.validation_status='valid'
    union all select ir.row_number,'department',nullif(btrim(ir.payload->>'department'),'') from public.import_rows ir where ir.import_id=p_import_id and ir.validation_status='valid'
    union all select ir.row_number,'cost_center',nullif(btrim(ir.payload->>'cost_center'),'') from public.import_rows ir where ir.import_id=p_import_id and ir.validation_status='valid'
    union all select ir.row_number,'region',nullif(btrim(ir.payload->>'region'),'') from public.import_rows ir where ir.import_id=p_import_id and ir.validation_status='valid'
    union all select ir.row_number,'product',nullif(btrim(ir.payload->>'product'),'') from public.import_rows ir where ir.import_id=p_import_id and ir.validation_status='valid'
    union all select ir.row_number,'project',nullif(btrim(ir.payload->>'project'),'') from public.import_rows ir where ir.import_id=p_import_id and ir.validation_status='valid'
  ), unresolved as (
    select dv.* from dimension_values dv where dv.value is not null and (
      (dv.dimension='legal_entity' and (select count(*) from public.legal_entities x where x.organization_id=v_org and (lower(btrim(x.code))=lower(dv.value) or lower(btrim(x.name))=lower(dv.value)))<>1)
      or (dv.dimension='branch' and (select count(*) from public.branches x where x.organization_id=v_org and (lower(btrim(x.code))=lower(dv.value) or lower(btrim(x.name))=lower(dv.value)))<>1)
      or (dv.dimension='department' and (select count(*) from public.departments x where x.organization_id=v_org and (lower(btrim(x.code))=lower(dv.value) or lower(btrim(x.name))=lower(dv.value)))<>1)
      or (dv.dimension='cost_center' and (select count(*) from public.cost_centers x where x.organization_id=v_org and (lower(btrim(x.code))=lower(dv.value) or lower(btrim(x.name))=lower(dv.value)))<>1)
      or (dv.dimension='region' and (select count(*) from public.regions x where x.organization_id=v_org and (lower(btrim(x.code))=lower(dv.value) or lower(btrim(x.name))=lower(dv.value)))<>1)
      or (dv.dimension='product' and (select count(*) from public.products x where x.organization_id=v_org and (lower(btrim(x.code))=lower(dv.value) or lower(btrim(x.name))=lower(dv.value)))<>1)
      or (dv.dimension='project' and (select count(*) from public.projects x where x.organization_id=v_org and (lower(btrim(x.code))=lower(dv.value) or lower(btrim(x.name))=lower(dv.value)))<>1)
    )
  ) select count(*) into v_unresolved from unresolved;
  if v_unresolved>0 then raise exception 'Import contains % unresolved or ambiguous master-data dimension values; map them before publish',v_unresolved; end if;

  select o.base_currency into v_currency from public.organizations o where o.id=v_org;

  insert into public.financial_periods(organization_id,period_start,period_end,status)
  select v_org,m.period_start,(m.period_start+interval '1 month - 1 day')::date,'open'
  from (select distinct date_trunc('month',(ir.payload->>'date')::date)::date period_start from public.import_rows ir where ir.import_id=p_import_id and ir.validation_status='valid') m
  on conflict(organization_id,period_start) do nothing;

  insert into public.financial_facts(organization_id,financial_period_id,account_id,legal_entity_id,branch_id,department_id,cost_center_id,region_id,product_id,project_id,currency,amount_minor,fact_type,source_import_id,source_row_key,journal_no,description,debit_minor,credit_minor,transaction_date,status)
  select ir.organization_id,fp.id,m.target_account_id,le.id,br.id,dep.id,cc.id,rg.id,pr.id,pj.id,v_currency,
    round(coalesce(nullif(ir.payload->>'debit','')::numeric,0)*100)::bigint-round(coalesce(nullif(ir.payload->>'credit','')::numeric,0)*100)::bigint,'actual',p_import_id,ir.source_key,ir.payload->>'journal_no',ir.payload->>'description',
    round(coalesce(nullif(ir.payload->>'debit','')::numeric,0)*100)::bigint,round(coalesce(nullif(ir.payload->>'credit','')::numeric,0)*100)::bigint,(ir.payload->>'date')::date,'published'
  from public.import_rows ir
  join public.account_mappings m on m.organization_id=ir.organization_id and m.mapping_version=trim(p_mapping_version) and m.source_code=(ir.payload->>'account_code') and m.status='approved'
  join public.financial_periods fp on fp.organization_id=ir.organization_id and fp.period_start=date_trunc('month',(ir.payload->>'date')::date)::date
  left join lateral (select x.id from public.legal_entities x where x.organization_id=v_org and nullif(btrim(ir.payload->>'legal_entity'),'') is not null and (lower(btrim(x.code))=lower(btrim(ir.payload->>'legal_entity')) or lower(btrim(x.name))=lower(btrim(ir.payload->>'legal_entity'))) limit 1) le on true
  left join lateral (select x.id from public.branches x where x.organization_id=v_org and nullif(btrim(ir.payload->>'branch'),'') is not null and (lower(btrim(x.code))=lower(btrim(ir.payload->>'branch')) or lower(btrim(x.name))=lower(btrim(ir.payload->>'branch'))) limit 1) br on true
  left join lateral (select x.id from public.departments x where x.organization_id=v_org and nullif(btrim(ir.payload->>'department'),'') is not null and (lower(btrim(x.code))=lower(btrim(ir.payload->>'department')) or lower(btrim(x.name))=lower(btrim(ir.payload->>'department'))) limit 1) dep on true
  left join lateral (select x.id from public.cost_centers x where x.organization_id=v_org and nullif(btrim(ir.payload->>'cost_center'),'') is not null and (lower(btrim(x.code))=lower(btrim(ir.payload->>'cost_center')) or lower(btrim(x.name))=lower(btrim(ir.payload->>'cost_center'))) limit 1) cc on true
  left join lateral (select x.id from public.regions x where x.organization_id=v_org and nullif(btrim(ir.payload->>'region'),'') is not null and (lower(btrim(x.code))=lower(btrim(ir.payload->>'region')) or lower(btrim(x.name))=lower(btrim(ir.payload->>'region'))) limit 1) rg on true
  left join lateral (select x.id from public.products x where x.organization_id=v_org and nullif(btrim(ir.payload->>'product'),'') is not null and (lower(btrim(x.code))=lower(btrim(ir.payload->>'product')) or lower(btrim(x.name))=lower(btrim(ir.payload->>'product'))) limit 1) pr on true
  left join lateral (select x.id from public.projects x where x.organization_id=v_org and nullif(btrim(ir.payload->>'project'),'') is not null and (lower(btrim(x.code))=lower(btrim(ir.payload->>'project')) or lower(btrim(x.name))=lower(btrim(ir.payload->>'project'))) limit 1) pj on true
  where ir.import_id=p_import_id and ir.validation_status='valid';

  insert into public.actuals_publish_batches(organization_id,import_id,mapping_version,status,row_count,published_at,published_by)
  values(v_org,p_import_id,trim(p_mapping_version),'published',v_rows,now(),v_user) returning id into v_batch;
  update public.imports set status='published',imported_row_count=v_rows,published_at=now(),mapping_version=trim(p_mapping_version),published_by=v_user where id=p_import_id;
  insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata)
  values(v_org,p_import_id,v_user,'publish','mapping_required','published',jsonb_build_object('row_count',v_rows,'mapping_version',trim(p_mapping_version),'dimensions_resolved',true));
  return v_batch;
end;
$function$;
