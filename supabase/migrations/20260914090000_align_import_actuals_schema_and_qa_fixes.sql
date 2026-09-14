-- Align the import lifecycle with the actual production financial-facts schema.
-- Includes: reconciled import status, authenticated permission context, fact status,
-- financial period assignment, SAR fallback, journal versioning, rollback state,
-- and lineage creation.

alter table public.imports drop constraint if exists imports_status_check;
alter table public.imports add constraint imports_status_check
  check (status = any (array['uploaded','validating','mapping_required','ready_for_review','reconciled','importing','imported','published','failed','rolled_back']::text[]));

alter table public.financial_facts add column if not exists status text not null default 'published';
alter table public.financial_facts drop constraint if exists financial_facts_status_check;
alter table public.financial_facts add constraint financial_facts_status_check
  check (status = any (array['draft','published','voided','superseded','rolled_back']::text[]));
create index if not exists financial_facts_org_period_status_idx
  on public.financial_facts (organization_id, financial_period_id, fact_type, status);

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id=target_organization_id and user_id=auth.uid()
  );
$$;

create or replace function public.has_org_permission(p_organization_id uuid, p_permission_key text)
returns boolean language sql security definer set search_path='' set row_security=off
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.organization_member_permission_overrides po
      on po.organization_id=om.organization_id and po.user_id=om.user_id
    where om.organization_id=p_organization_id
      and om.user_id=auth.uid()
      and om.permissions_initialized=true
      and po.permission_key=p_permission_key
      and po.granted=true
  );
$$;

create or replace function public.publish_actuals_from_import(p_import_id uuid, p_mapping_version text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=(select auth.uid()); v_org uuid; v_status text; v_mapping text;
  v_batch_id uuid; v_rows integer; v_bad integer; v_existing uuid;
  v_period_id uuid; v_min_date date; v_max_date date;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select organization_id,status,mapping_version into v_org,v_status,v_mapping
  from public.imports where id=p_import_id for update;
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
  select count(*),count(*) filter(where validation_status<>'valid') into v_rows,v_bad
  from public.import_rows where import_id=p_import_id;
  if v_rows=0 or v_bad>0 then raise exception 'Import contains invalid rows'; end if;
  if exists(select 1 from public.import_rows r left join public.account_mappings m
    on m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version)
    and m.source_code=(r.payload->>'account_code') and m.status='approved'
    where r.import_id=p_import_id and m.id is null) then
    raise exception 'Approved mapping coverage is incomplete';
  end if;
  select min((payload->>'date')::date),max((payload->>'date')::date) into v_min_date,v_max_date
  from public.import_rows where import_id=p_import_id;
  select id into v_period_id from public.financial_periods
  where organization_id=v_org and period_start=v_min_date and period_end=v_max_date limit 1;
  if v_period_id is null then
    insert into public.financial_periods(organization_id,period_start,period_end,status)
    values(v_org,v_min_date,v_max_date,'open') returning id into v_period_id;
  end if;
  insert into public.actuals_publish_batches(organization_id,import_id,mapping_version,status,published_by,published_at)
  values(v_org,p_import_id,btrim(p_mapping_version),'published',v_user,now()) returning id into v_batch_id;
  update public.financial_facts old_fact set status='superseded',superseded_by=v_batch_id,superseded_at=now()
  where old_fact.organization_id=v_org and old_fact.fact_type='actual' and old_fact.status='published'
    and old_fact.journal_no is not null and old_fact.journal_no in
      (select distinct r.payload->>'journal_no' from public.import_rows r where r.import_id=p_import_id
       and nullif(btrim(r.payload->>'journal_no'),'') is not null);
  insert into public.financial_facts(
    organization_id,financial_period_id,source_import_id,source_batch_id,fact_type,account_id,currency,
    amount_minor,description,journal_no,debit_minor,credit_minor,source_row_key,version_no,record_hash,status)
  select v_org,v_period_id,p_import_id,v_batch_id,'actual',m.target_account_id,
    coalesce(nullif(r.payload->>'currency',''),'SAR')::char(3),
    round(((coalesce(nullif(r.payload->>'debit','')::numeric,0)-coalesce(nullif(r.payload->>'credit','')::numeric,0))*100))::bigint,
    r.payload->>'description',r.payload->>'journal_no',
    round(coalesce(nullif(r.payload->>'debit','')::numeric,0)*100)::bigint,
    round(coalesce(nullif(r.payload->>'credit','')::numeric,0)*100)::bigint,
    coalesce(nullif(r.source_key,''),r.row_number::text),
    coalesce((select max(f.version_no)+1 from public.financial_facts f
      where f.organization_id=v_org and f.journal_no=r.payload->>'journal_no'),1),
    encode(extensions.digest(convert_to(r.payload::text,'UTF8'),'sha256'),'hex'),'published'
  from public.import_rows r join public.account_mappings m
    on m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version)
    and m.source_code=(r.payload->>'account_code') and m.status='approved'
  where r.import_id=p_import_id;
  insert into public.data_lineage(
    organization_id,source_record_key,source_entity_type,normalized_entity_type,normalized_record_id,
    source_reference,mapping_version,observed_at)
  select v_org,coalesce(nullif(r.source_key,''),r.row_number::text),'import_row','financial_fact',f.id,
    'import:'||p_import_id::text,btrim(p_mapping_version),now()
  from public.import_rows r join public.financial_facts f
    on f.organization_id=v_org and f.source_import_id=p_import_id
    and f.source_row_key=coalesce(nullif(r.source_key,''),r.row_number::text)
    and f.source_batch_id=v_batch_id
  where r.import_id=p_import_id;
  update public.imports set status='published',published_at=now(),published_by=v_user,imported_row_count=v_rows where id=p_import_id;
  perform public.write_audit_event(v_org,'actuals.publish','import',p_import_id::text,null,
    jsonb_build_object('batch_id',v_batch_id,'mapping_version',btrim(p_mapping_version),'row_count',v_rows,
      'financial_period_id',v_period_id,'versioning','journal_no_supersedes_previous','lineage','import_row_to_financial_fact'));
  return v_batch_id;
end; $$;

create or replace function public.rollback_actuals_import(p_import_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  v_user_id uuid:=(select auth.uid()); v_org_id uuid; v_batch_id uuid;
  v_fact_count integer:=0; v_current_status text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_import_id is null then raise exception 'Import ID is required'; end if;
  if p_reason is null or btrim(p_reason)='' then raise exception 'Rollback reason is required'; end if;
  if length(p_reason)>2000 then raise exception 'Rollback reason exceeds 2000 characters'; end if;
  select i.organization_id,i.status into v_org_id,v_current_status from public.imports i where i.id=p_import_id for update;
  if v_org_id is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org_id,'import.rollback') then raise exception 'Import rollback permission required'; end if;
  if v_current_status<>'published' then raise exception 'Only published imports can be rolled back'; end if;
  select b.id into v_batch_id from public.actuals_publish_batches b
  where b.import_id=p_import_id and b.organization_id=v_org_id and b.status='published'
  order by b.published_at desc nulls last,b.created_at desc limit 1 for update;
  if v_batch_id is null then raise exception 'Published batch not found for import'; end if;
  select count(*)::integer into v_fact_count from public.financial_facts f
  where f.organization_id=v_org_id and f.source_import_id=p_import_id and f.fact_type='actual' and f.status='published';
  update public.financial_facts f set status='rolled_back',superseded_at=coalesce(f.superseded_at,now())
  where f.organization_id=v_org_id and f.source_import_id=p_import_id and f.fact_type='actual' and f.status='published';
  update public.actuals_publish_batches set status='rejected' where id=v_batch_id;
  update public.imports set status='rolled_back' where id=p_import_id;
  insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata)
  values(v_org_id,p_import_id,v_user_id,'rollback','published','rolled_back',
    jsonb_build_object('batch_id',v_batch_id,'reason',p_reason,'rolled_back_fact_count',v_fact_count,'history_preserved',true));
  return v_batch_id;
end; $$;
