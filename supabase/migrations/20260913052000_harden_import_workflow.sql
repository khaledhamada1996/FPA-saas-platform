begin;

insert into public.organization_permissions(permission_key,name,description,permission_type,screen_key,route_path,category,sort_order)
values
 ('import.view','عرض الاستيرادات','عرض ومراجعة بيانات الاستيراد','action','screen.data.view','/workspace/data','Data & Import',110),
 ('import.create','إنشاء استيراد','رفع وإنشاء عملية استيراد جديدة','action','screen.data.view','/workspace/data','Data & Import',111),
 ('import.prepare','تجهيز الاستيراد للمراجعة','تجهيز الاستيراد بعد اكتمال الربط','action','screen.data.view','/workspace/data','Data & Import',112),
 ('import.reconcile','مطابقة الاستيراد','تنفيذ المطابقة والتسوية قبل النشر','action','screen.data.view','/workspace/data','Data & Import',113),
 ('import.rollback','التراجع عن استيراد منشور','التراجع عن آثار استيراد منشور','action','screen.data.view','/workspace/data','Data & Import',114)
on conflict(permission_key) do update set name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,screen_key=excluded.screen_key,route_path=excluded.route_path,category=excluded.category,sort_order=excluded.sort_order;

insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select x.organization_id,x.user_id,p.permission_key,true
from (select distinct organization_id,user_id,permission_key from public.organization_member_permission_overrides where granted=true and permission_key in ('import','reject')) x
cross join lateral (values
 (case when x.permission_key='import' then 'import.view' end),
 (case when x.permission_key='import' then 'import.create' end),
 (case when x.permission_key='import' then 'import.prepare' end),
 (case when x.permission_key='import' then 'import.reconcile' end),
 (case when x.permission_key='reject' then 'import.rollback' end)
) p(permission_key)
where p.permission_key is not null
on conflict(organization_id,user_id,permission_key) do update set granted=true;

create or replace function public.ingest_validated_import(p_organization_id uuid,p_file_name text,p_file_hash text,p_rows jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_user uuid:=(select auth.uid()); v_import_id uuid; v_existing_id uuid; v_row_count integer; v_bad_count integer; v_unbalanced_count integer;
begin
if v_user is null then raise exception 'Authentication required'; end if;
if p_organization_id is null then raise exception 'Organization is required'; end if;
if not public.has_org_permission(p_organization_id,'import.create') then raise exception 'Import create permission required'; end if;
if jsonb_typeof(p_rows)<>'array' then raise exception 'Rows must be a JSON array'; end if;
v_row_count:=jsonb_array_length(p_rows); if v_row_count=0 then raise exception 'Import contains no rows'; end if; if v_row_count>50000 then raise exception 'Import exceeds the 50000 row limit'; end if;
if nullif(trim(p_file_name),'') is null then raise exception 'File name is required'; end if;
if p_file_hash is not null then select id into v_existing_id from public.imports where organization_id=p_organization_id and file_hash=p_file_hash order by created_at desc limit 1; if v_existing_id is not null then return v_existing_id; end if; end if;
with parsed as (select elem,nullif(trim(elem->>'date'),'') date_text,nullif(trim(elem->>'journal_no'),'') journal_no,nullif(trim(elem->>'account_code'),'') account_code,nullif(trim(elem->>'account_name'),'') account_name,case when coalesce(elem->>'debit','') ~ '^([0-9]+(\\.[0-9]+)?)$' then (elem->>'debit')::numeric else null end debit,case when coalesce(elem->>'credit','') ~ '^([0-9]+(\\.[0-9]+)?)$' then (elem->>'credit')::numeric else null end credit from jsonb_array_elements(p_rows) elem) select count(*) into v_bad_count from parsed where date_text is null or date_text !~ '^\\d{4}-\\d{2}-\\d{2}$' or journal_no is null or account_code is null or account_name is null or debit is null or credit is null or debit<0 or credit<0 or (debit>0 and credit>0) or (debit=0 and credit=0);
if v_bad_count>0 then raise exception 'Import contains invalid rows: %',v_bad_count; end if;
with parsed as (select elem->>'journal_no' journal_no,(elem->>'debit')::numeric debit,(elem->>'credit')::numeric credit from jsonb_array_elements(p_rows) elem),unbalanced as (select journal_no from parsed group by journal_no having abs(sum(debit)-sum(credit))>0.005) select count(*) into v_unbalanced_count from unbalanced;
if v_unbalanced_count>0 then raise exception 'Import contains % unbalanced journal entries',v_unbalanced_count; end if;
insert into public.imports(organization_id,file_name,file_hash,status,row_count,imported_row_count,error_count,warning_count,created_by) values(p_organization_id,trim(p_file_name),p_file_hash,'mapping_required',v_row_count,0,0,0,v_user) returning id into v_import_id;
insert into public.import_rows(import_id,organization_id,row_number,source_key,payload,validation_status,validation_message) select v_import_id,p_organization_id,ordinality::integer,coalesce(nullif(elem->>'source_key',''),coalesce(p_file_hash,'no-hash')||':'||ordinality::text),elem-'source_key','valid',null from jsonb_array_elements(p_rows) with ordinality;
insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata) values(p_organization_id,v_import_id,v_user,'ingest',null,'mapping_required',jsonb_build_object('row_count',v_row_count,'file_name',trim(p_file_name)));
return v_import_id; end; $$;

create or replace function public.prepare_import_for_review(p_import_id uuid,p_mapping_version text)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_user uuid:=(select auth.uid()); v_org uuid; v_status text; v_missing integer;
begin
if v_user is null then raise exception 'Authentication required'; end if; if p_mapping_version is null or btrim(p_mapping_version)='' then raise exception 'Mapping version is required'; end if;
select organization_id,status into v_org,v_status from public.imports where id=p_import_id for update; if v_org is null then raise exception 'Import not found'; end if;
if not public.has_org_permission(v_org,'import.prepare') then raise exception 'Import prepare permission required'; end if;
if v_status not in ('mapping_required','validated','ready_for_review') then raise exception 'Import cannot be prepared from status %',v_status; end if;
select count(*) into v_missing from public.import_rows r left join public.account_mappings m on m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.source_code=(r.payload->>'account_code') and m.status='approved' where r.import_id=p_import_id and m.id is null;
if v_missing>0 then raise exception 'Import requires % approved account mappings',v_missing; end if;
update public.imports set mapping_version=btrim(p_mapping_version),status='ready_for_review' where id=p_import_id;
insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata) values(v_org,p_import_id,v_user,'prepare_for_review',v_status,'ready_for_review',jsonb_build_object('mapping_version',btrim(p_mapping_version)));
return p_import_id; end; $$;

create or replace function public.reconcile_import(p_import_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_user uuid:=(select auth.uid()); v_org uuid; v_status text; v_mapping text; v_rows integer; v_bad integer; v_debit bigint; v_credit bigint; v_net bigint; v_id uuid;
begin
if v_user is null then raise exception 'Authentication required'; end if;
select organization_id,status,mapping_version into v_org,v_status,v_mapping from public.imports where id=p_import_id for update; if v_org is null then raise exception 'Import not found'; end if;
if not public.has_org_permission(v_org,'import.reconcile') then raise exception 'Import reconcile permission required'; end if; if v_status<>'ready_for_review' then raise exception 'Import is not ready for reconciliation'; end if; if v_mapping is null or btrim(v_mapping)='' then raise exception 'Mapping version is required'; end if;
select count(*),count(*) filter(where validation_status<>'valid') into v_rows,v_bad from public.import_rows where import_id=p_import_id; if v_rows=0 or v_bad>0 then raise exception 'Import contains invalid rows'; end if;
if exists(select 1 from public.import_rows r left join public.account_mappings m on m.organization_id=v_org and m.mapping_version=btrim(v_mapping) and m.source_code=(r.payload->>'account_code') and m.status='approved' where r.import_id=p_import_id and m.id is null) then raise exception 'Approved mapping coverage is incomplete'; end if;
select coalesce(round(sum(coalesce(nullif(r.payload->>'debit','')::numeric,0))*100),0)::bigint,coalesce(round(sum(coalesce(nullif(r.payload->>'credit','')::numeric,0))*100),0)::bigint into v_debit,v_credit from public.import_rows r where r.import_id=p_import_id; v_net:=v_debit-v_credit;
insert into public.import_reconciliations(organization_id,import_id,mapping_version,source_row_count,accepted_row_count,rejected_row_count,source_debit_minor,source_credit_minor,normalized_net_minor,difference_minor,status,updated_at) values(v_org,p_import_id,btrim(v_mapping),v_rows,v_rows,0,v_debit,v_credit,v_net,0,'passed',now()) on conflict(import_id) do update set mapping_version=excluded.mapping_version,source_row_count=excluded.source_row_count,accepted_row_count=excluded.accepted_row_count,rejected_row_count=excluded.rejected_row_count,source_debit_minor=excluded.source_debit_minor,source_credit_minor=excluded.source_credit_minor,normalized_net_minor=excluded.normalized_net_minor,difference_minor=excluded.difference_minor,status='passed',override_reason=null,overridden_by=null,overridden_at=null,updated_at=now() returning id into v_id;
insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata) values(v_org,p_import_id,v_user,'reconcile',v_status,v_status,jsonb_build_object('reconciliation_id',v_id,'difference_minor',0,'mapping_version',btrim(v_mapping)));
return v_id; end; $$;

create or replace function public.rollback_actuals_import(p_import_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_user_id uuid:=(select auth.uid()); v_org_id uuid; v_batch_id uuid; v_deleted_fact_count integer:=0; v_current_status text;
begin
if v_user_id is null then raise exception 'Authentication required'; end if; if p_import_id is null then raise exception 'Import ID is required'; end if; if p_reason is null or btrim(p_reason)='' then raise exception 'Rollback reason is required'; end if; if length(p_reason)>2000 then raise exception 'Rollback reason exceeds 2000 characters'; end if;
select i.organization_id,i.status into v_org_id,v_current_status from public.imports i where i.id=p_import_id for update; if v_org_id is null then raise exception 'Import not found'; end if;
if not public.has_org_permission(v_org_id,'import.rollback') then raise exception 'Import rollback permission required'; end if; if v_current_status<>'published' then raise exception 'Only published imports can be rolled back'; end if;
select b.id into v_batch_id from public.actuals_publish_batches b where b.import_id=p_import_id and b.organization_id=v_org_id and b.status='published' order by b.published_at desc nulls last,b.created_at desc limit 1 for update; if v_batch_id is null then raise exception 'Published batch not found for import'; end if;
select count(*)::integer into v_deleted_fact_count from public.financial_facts f where f.organization_id=v_org_id and f.source_import_id=p_import_id and f.fact_type='actual'; delete from public.financial_facts f where f.organization_id=v_org_id and f.source_import_id=p_import_id and f.fact_type='actual';
update public.actuals_publish_batches set status='rejected' where id=v_batch_id; update public.imports set status='rolled_back' where id=p_import_id;
insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata) values(v_org_id,p_import_id,v_user_id,'rollback','published','rolled_back',jsonb_build_object('batch_id',v_batch_id,'reason',p_reason,'deleted_fact_count',v_deleted_fact_count)); return v_batch_id; end; $$;

create or replace function public.get_import_review(p_import_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_user uuid:=(select auth.uid()); v_org uuid; v_import jsonb; v_reconciliation jsonb; v_audit jsonb; v_sources jsonb; v_accounts jsonb; v_mappings jsonb;
begin
if v_user is null then raise exception 'Authentication required'; end if; if p_import_id is null then raise exception 'Import ID is required'; end if; select i.organization_id into v_org from public.imports i where i.id=p_import_id; if v_org is null then raise exception 'Import not found'; end if;
if not public.has_org_permission(v_org,'screen.data.view') or not public.has_org_permission(v_org,'import.view') then raise exception 'Import view permission required'; end if;
select jsonb_build_object('id',i.id,'organization_id',i.organization_id,'file_name',i.file_name,'file_hash',i.file_hash,'status',i.status,'row_count',i.row_count,'imported_row_count',i.imported_row_count,'error_count',i.error_count,'warning_count',i.warning_count,'mapping_version',i.mapping_version,'created_at',i.created_at,'published_at',i.published_at,'published_by',i.published_by) into v_import from public.imports i where i.id=p_import_id;
select coalesce((select jsonb_agg(to_jsonb(r) order by r.updated_at desc) from public.import_reconciliations r where r.import_id=p_import_id and r.organization_id=v_org),'[]'::jsonb) into v_reconciliation;
select coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'from_status',e.from_status,'to_status',e.to_status,'actor_id',e.actor_id,'metadata',e.metadata,'created_at',e.created_at) order by e.created_at desc) from public.import_audit_events e where e.import_id=p_import_id and e.organization_id=v_org),'[]'::jsonb) into v_audit;
select coalesce((select jsonb_agg(jsonb_build_object('source_code',s.source_code,'source_name',s.source_name,'row_count',s.row_count,'mapping_id',m.id,'mapping_status',m.status,'target_account_id',m.target_account_id,'target_account_code',a.code,'target_account_name',a.name) order by s.source_code) from (select r.payload->>'account_code' source_code,max(r.payload->>'account_name') source_name,count(*)::integer row_count from public.import_rows r where r.import_id=p_import_id group by r.payload->>'account_code' order by count(*) desc limit 500) s left join public.account_mappings m on m.organization_id=v_org and m.mapping_version=coalesce((v_import->>'mapping_version'),'v1') and m.source_code=s.source_code left join public.accounts a on a.id=m.target_account_id and a.organization_id=v_org),'[]'::jsonb) into v_sources;
select coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'code',a.code,'name',a.name,'account_type',a.account_type,'statement_type',a.statement_type,'statement_section',a.statement_section) order by a.code) from public.accounts a where a.organization_id=v_org limit 1000),'[]'::jsonb) into v_accounts;
select coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'mapping_version',m.mapping_version,'source_code',m.source_code,'source_name',m.source_name,'target_account_id',m.target_account_id,'status',m.status,'created_by',m.created_by,'approved_by',m.approved_by,'approved_at',m.approved_at) order by m.mapping_version,m.source_code) from public.account_mappings m where m.organization_id=v_org and (m.mapping_version=coalesce((v_import->>'mapping_version'),'v1') or m.status='draft') limit 1000),'[]'::jsonb) into v_mappings;
return jsonb_build_object('import',v_import,'reconciliation',v_reconciliation,'audit_events',v_audit,'sources',v_sources,'accounts',v_accounts,'mappings',v_mappings); end; $$;

revoke all on function public.ingest_validated_import(uuid,text,text,jsonb) from anon,public;
revoke all on function public.prepare_import_for_review(uuid,text) from anon,public;
revoke all on function public.reconcile_import(uuid) from anon,public;
revoke all on function public.rollback_actuals_import(uuid,text) from anon,public;
revoke all on function public.get_import_review(uuid) from anon,public;
grant execute on function public.ingest_validated_import(uuid,text,text,jsonb) to authenticated;
grant execute on function public.prepare_import_for_review(uuid,text) to authenticated;
grant execute on function public.reconcile_import(uuid) to authenticated;
grant execute on function public.rollback_actuals_import(uuid,text) to authenticated;
grant execute on function public.get_import_review(uuid) to authenticated;

commit;
