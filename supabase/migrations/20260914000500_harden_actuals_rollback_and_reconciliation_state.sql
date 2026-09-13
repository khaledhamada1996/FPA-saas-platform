create or replace function public.reconcile_import(p_import_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare v_user uuid:=(select auth.uid()); v_org uuid; v_status text; v_mapping text; v_rows integer; v_bad integer; v_debit bigint; v_credit bigint; v_net bigint; v_id uuid;
begin
if v_user is null then raise exception 'Authentication required'; end if;
select organization_id,status,mapping_version into v_org,v_status,v_mapping from public.imports where id=p_import_id for update;
if v_org is null then raise exception 'Import not found'; end if;
if not public.has_org_permission(v_org,'import.reconcile') then raise exception 'Import reconcile permission required'; end if;
if v_status<>'ready_for_review' then raise exception 'Import is not ready for reconciliation'; end if;
if v_mapping is null or btrim(v_mapping)='' then raise exception 'Mapping version is required'; end if;
select count(*),count(*) filter(where validation_status<>'valid') into v_rows,v_bad from public.import_rows where import_id=p_import_id;
if v_rows=0 or v_bad>0 then raise exception 'Import contains invalid rows'; end if;
if exists(select 1 from public.import_rows r left join public.account_mappings m on m.organization_id=v_org and m.mapping_version=btrim(v_mapping) and m.source_code=(r.payload->>'account_code') and m.status='approved' where r.import_id=p_import_id and m.id is null) then raise exception 'Approved mapping coverage is incomplete'; end if;
select coalesce(round(sum(coalesce(nullif(r.payload->>'debit','')::numeric,0))*100),0)::bigint,coalesce(round(sum(coalesce(nullif(r.payload->>'credit','')::numeric,0))*100),0)::bigint into v_debit,v_credit from public.import_rows r where r.import_id=p_import_id;
v_net:=v_debit-v_credit;
insert into public.import_reconciliations(organization_id,import_id,mapping_version,source_row_count,accepted_row_count,rejected_row_count,source_debit_minor,source_credit_minor,normalized_net_minor,difference_minor,status,updated_at)
values(v_org,p_import_id,btrim(v_mapping),v_rows,v_rows,0,v_debit,v_credit,v_net,0,'passed',now())
on conflict(import_id) do update set mapping_version=excluded.mapping_version,source_row_count=excluded.source_row_count,accepted_row_count=excluded.accepted_row_count,rejected_row_count=excluded.rejected_row_count,source_debit_minor=excluded.source_debit_minor,source_credit_minor=excluded.source_credit_minor,normalized_net_minor=excluded.normalized_net_minor,difference_minor=excluded.difference_minor,status='passed',override_reason=null,overridden_by=null,overridden_at=null,updated_at=now()
returning id into v_id;
update public.imports set status='reconciled' where id=p_import_id;
insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata) values(v_org,p_import_id,v_user,'reconcile',v_status,'reconciled',jsonb_build_object('reconciliation_id',v_id,'difference_minor',0,'mapping_version',btrim(v_mapping)));
return v_id;
end;
$function$;

create or replace function public.rollback_actuals_import(p_import_id uuid,p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare v_user_id uuid:=(select auth.uid()); v_org_id uuid; v_batch_id uuid; v_fact_count integer:=0; v_current_status text;
begin
if v_user_id is null then raise exception 'Authentication required'; end if;
if p_import_id is null then raise exception 'Import ID is required'; end if;
if p_reason is null or btrim(p_reason)='' then raise exception 'Rollback reason is required'; end if;
if length(p_reason)>2000 then raise exception 'Rollback reason exceeds 2000 characters'; end if;
select i.organization_id,i.status into v_org_id,v_current_status from public.imports i where i.id=p_import_id for update;
if v_org_id is null then raise exception 'Import not found'; end if;
if not public.has_org_permission(v_org_id,'import.rollback') then raise exception 'Import rollback permission required'; end if;
if v_current_status<>'published' then raise exception 'Only published imports can be rolled back'; end if;
select b.id into v_batch_id from public.actuals_publish_batches b where b.import_id=p_import_id and b.organization_id=v_org_id and b.status='published' order by b.published_at desc nulls last,b.created_at desc limit 1 for update;
if v_batch_id is null then raise exception 'Published batch not found for import'; end if;
select count(*)::integer into v_fact_count from public.financial_facts f where f.organization_id=v_org_id and f.source_import_id=p_import_id and f.fact_type='actual';
update public.financial_facts f set fact_type='actual_rolled_back', superseded_at=coalesce(f.superseded_at,now()) where f.organization_id=v_org_id and f.source_import_id=p_import_id and f.fact_type='actual';
update public.actuals_publish_batches set status='rejected' where id=v_batch_id;
update public.imports set status='rolled_back' where id=p_import_id;
insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata) values(v_org_id,p_import_id,v_user_id,'rollback','published','rolled_back',jsonb_build_object('batch_id',v_batch_id,'reason',p_reason,'rolled_back_fact_count',v_fact_count,'history_preserved',true));
return v_batch_id;
end;
$function$;
