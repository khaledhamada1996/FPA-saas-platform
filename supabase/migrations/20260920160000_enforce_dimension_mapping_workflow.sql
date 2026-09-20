-- Enforce complete approved dimension mapping coverage before review/reconciliation.
create or replace function public.prepare_import_for_review(p_import_id uuid, p_mapping_version text)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_status text;
  v_missing_accounts integer;
  v_missing_dimensions integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_mapping_version is null or btrim(p_mapping_version)='' then raise exception 'Mapping version is required'; end if;
  select organization_id,status into v_org,v_status from public.imports where id=p_import_id for update;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org,'import.prepare') then raise exception 'Import prepare permission required'; end if;
  if v_status not in ('mapping_required','validated','ready_for_review') then raise exception 'Import cannot be prepared from status %',v_status; end if;

  select count(*) into v_missing_accounts
  from public.import_rows r
  where r.import_id=p_import_id and not exists (
    select 1 from public.account_mappings m
    where m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version)
      and m.source_code=(r.payload->>'account_code') and m.status='approved'
  );
  if v_missing_accounts>0 then raise exception 'Import requires % approved account mappings',v_missing_accounts; end if;

  with vals as (
    select 'legal_entity' dimension_type,nullif(btrim(payload->>'legal_entity'),'') source_value from public.import_rows where import_id=p_import_id
    union all select 'branch',nullif(btrim(payload->>'branch'),'') from public.import_rows where import_id=p_import_id
    union all select 'department',nullif(btrim(payload->>'department'),'') from public.import_rows where import_id=p_import_id
    union all select 'cost_center',nullif(btrim(payload->>'cost_center'),'') from public.import_rows where import_id=p_import_id
    union all select 'region',nullif(btrim(payload->>'region'),'') from public.import_rows where import_id=p_import_id
    union all select 'product',nullif(btrim(payload->>'product'),'') from public.import_rows where import_id=p_import_id
    union all select 'project',nullif(btrim(payload->>'project'),'') from public.import_rows where import_id=p_import_id
  ), needed as (select distinct dimension_type,source_value from vals where source_value is not null)
  select count(*) into v_missing_dimensions from needed n
  where not exists (
    select 1 from public.import_dimension_mappings dm
    where dm.import_id=p_import_id and dm.organization_id=v_org
      and dm.dimension_type=n.dimension_type
      and lower(btrim(dm.source_value))=lower(btrim(n.source_value))
      and dm.status='approved'
  );
  if v_missing_dimensions>0 then raise exception 'Import requires % approved dimension mappings',v_missing_dimensions; end if;

  update public.imports set mapping_version=btrim(p_mapping_version),status='ready_for_review' where id=p_import_id;
  insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata)
  values(v_org,p_import_id,v_user,'prepare_for_review',v_status,'ready_for_review',
         jsonb_build_object('mapping_version',btrim(p_mapping_version),'dimension_mapping_required',true));
  return p_import_id;
end;
$function$;

create or replace function public.reconcile_import(p_import_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid:=(select auth.uid());
  v_org uuid; v_status text; v_mapping text;
  v_rows integer; v_bad integer; v_missing_dimensions integer;
  v_debit bigint; v_credit bigint; v_net bigint; v_id uuid; v_recon_status text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select organization_id,status,mapping_version into v_org,v_status,v_mapping from public.imports where id=p_import_id for update;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org,'import.reconcile') then raise exception 'Import reconcile permission required'; end if;
  if v_status<>'ready_for_review' then raise exception 'Import is not ready for reconciliation'; end if;
  if v_mapping is null or btrim(v_mapping)='' then raise exception 'Mapping version is required'; end if;
  select count(*),count(*) filter(where validation_status<>'valid') into v_rows,v_bad from public.import_rows where import_id=p_import_id;
  if v_rows=0 or v_bad>0 then raise exception 'Import contains invalid rows'; end if;
  if exists(select 1 from public.import_rows r where r.import_id=p_import_id and not exists(
    select 1 from public.account_mappings m where m.organization_id=v_org and m.mapping_version=btrim(v_mapping)
      and m.source_code=(r.payload->>'account_code') and m.status='approved'
  )) then raise exception 'Approved account mapping coverage is incomplete'; end if;

  with vals as (
    select 'legal_entity' dimension_type,nullif(btrim(payload->>'legal_entity'),'') source_value from public.import_rows where import_id=p_import_id
    union all select 'branch',nullif(btrim(payload->>'branch'),'') from public.import_rows where import_id=p_import_id
    union all select 'department',nullif(btrim(payload->>'department'),'') from public.import_rows where import_id=p_import_id
    union all select 'cost_center',nullif(btrim(payload->>'cost_center'),'') from public.import_rows where import_id=p_import_id
    union all select 'region',nullif(btrim(payload->>'region'),'') from public.import_rows where import_id=p_import_id
    union all select 'product',nullif(btrim(payload->>'product'),'') from public.import_rows where import_id=p_import_id
    union all select 'project',nullif(btrim(payload->>'project'),'') from public.import_rows where import_id=p_import_id
  ), needed as (select distinct dimension_type,source_value from vals where source_value is not null)
  select count(*) into v_missing_dimensions from needed n
  where not exists (
    select 1 from public.import_dimension_mappings dm
    where dm.import_id=p_import_id and dm.organization_id=v_org
      and dm.dimension_type=n.dimension_type
      and lower(btrim(dm.source_value))=lower(btrim(n.source_value))
      and dm.status='approved'
  );
  if v_missing_dimensions>0 then raise exception 'Import requires % approved dimension mappings',v_missing_dimensions; end if;

  select coalesce(round(sum(coalesce(nullif(r.payload->>'debit','')::numeric,0))*100),0)::bigint,
         coalesce(round(sum(coalesce(nullif(r.payload->>'credit','')::numeric,0))*100),0)::bigint
  into v_debit,v_credit from public.import_rows r where r.import_id=p_import_id;
  v_net:=v_debit-v_credit; v_recon_status:=case when v_net=0 then 'passed' else 'failed' end;
  insert into public.import_reconciliations(
    organization_id,import_id,mapping_version,source_row_count,accepted_row_count,rejected_row_count,
    source_debit_minor,source_credit_minor,normalized_net_minor,difference_minor,status,updated_at)
  values(v_org,p_import_id,btrim(v_mapping),v_rows,v_rows,0,v_debit,v_credit,v_net,v_net,v_recon_status,now())
  on conflict(import_id) do update set mapping_version=excluded.mapping_version,source_row_count=excluded.source_row_count,
    accepted_row_count=excluded.accepted_row_count,rejected_row_count=excluded.rejected_row_count,
    source_debit_minor=excluded.source_debit_minor,source_credit_minor=excluded.source_credit_minor,
    normalized_net_minor=excluded.normalized_net_minor,difference_minor=excluded.difference_minor,status=excluded.status,
    override_reason=null,overridden_by=null,overridden_at=null,updated_at=now()
  returning id into v_id;
  if v_net=0 then
    update public.imports set status='reconciled' where id=p_import_id;
    insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata)
    values(v_org,p_import_id,v_user,'reconcile',v_status,'reconciled',
           jsonb_build_object('reconciliation_id',v_id,'difference_minor',0,'mapping_version',btrim(v_mapping),'status','passed'));
  else
    insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata)
    values(v_org,p_import_id,v_user,'reconcile_failed',v_status,v_status,
           jsonb_build_object('reconciliation_id',v_id,'difference_minor',v_net,'mapping_version',btrim(v_mapping),'status','failed'));
  end if;
  return v_id;
end;
$function$;

revoke all on function public.prepare_import_for_review(uuid,text) from public, anon;
grant execute on function public.prepare_import_for_review(uuid,text) to authenticated;
revoke all on function public.reconcile_import(uuid) from public, anon;
grant execute on function public.reconcile_import(uuid) to authenticated;
