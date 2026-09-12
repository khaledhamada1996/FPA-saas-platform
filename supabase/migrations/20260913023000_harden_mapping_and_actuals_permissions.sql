-- Granular authorization for Mapping + Actuals publish.
-- Server/RPC checks remain authoritative; UI must not be treated as a security boundary.

insert into public.organization_permissions(permission_key,name,description,permission_type,screen_key,route_path,category,sort_order)
values
 ('mapping.view','View account mappings','View account mapping workspace and mapping records','action','screen.actuals.view','/workspace/actuals','Data & Import',210),
 ('mapping.create','Create account mappings','Create new draft account mappings','action','screen.actuals.view','/workspace/actuals','Data & Import',211),
 ('mapping.edit','Edit account mappings','Edit draft or rejected account mappings','action','screen.actuals.view','/workspace/actuals','Data & Import',212),
 ('mapping.approve','Approve or reject account mappings','Approve or reject account mappings; creator cannot approve own mapping','action','screen.actuals.view','/workspace/actuals','Data & Import',213),
 ('mapping.delete','Delete account mappings','Delete draft or rejected account mappings','action','screen.actuals.view','/workspace/actuals','Data & Import',214)
on conflict(permission_key) do update set
 name=excluded.name, description=excluded.description, permission_type=excluded.permission_type,
 screen_key=excluded.screen_key, route_path=excluded.route_path, category=excluded.category, sort_order=excluded.sort_order;

-- Preserve existing initialized users' effective legacy capabilities.
insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select o.organization_id,o.user_id,p.permission_key,true
from public.organization_member_permission_overrides o
cross join public.organization_permissions p
where o.permission_key='import' and o.granted=true
  and p.permission_key in ('mapping.view','mapping.create','mapping.edit','mapping.delete')
  and exists(select 1 from public.organization_members m where m.organization_id=o.organization_id and m.user_id=o.user_id and m.permissions_initialized=true)
on conflict(organization_id,user_id,permission_key) do nothing;

insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select o.organization_id,o.user_id,'mapping.approve',true
from public.organization_member_permission_overrides o
where o.permission_key='approve' and o.granted=true
  and exists(select 1 from public.organization_members m where m.organization_id=o.organization_id and m.user_id=o.user_id and m.permissions_initialized=true)
on conflict(organization_id,user_id,permission_key) do nothing;

-- Existing users who could submit imports retain actuals publishing capability.
insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select o.organization_id,o.user_id,'actuals.publish',true
from public.organization_member_permission_overrides o
where o.permission_key='submit' and o.granted=true
  and exists(select 1 from public.organization_members m where m.organization_id=o.organization_id and m.user_id=o.user_id and m.permissions_initialized=true)
on conflict(organization_id,user_id,permission_key) do nothing;

-- Mapping read boundary.
create or replace function public.get_import_review(p_import_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=(select auth.uid()); v_org uuid; v_import jsonb; v_reconciliation jsonb; v_audit jsonb; v_sources jsonb; v_accounts jsonb; v_mappings jsonb;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_import_id is null then raise exception 'Import ID is required'; end if;
 select i.organization_id into v_org from public.imports i where i.id=p_import_id;
 if v_org is null then raise exception 'Import not found'; end if;
 if not public.has_org_permission(v_org,'mapping.view') then raise exception 'Mapping view permission required'; end if;
 select jsonb_build_object('id',i.id,'organization_id',i.organization_id,'file_name',i.file_name,'file_hash',i.file_hash,'status',i.status,'row_count',i.row_count,'imported_row_count',i.imported_row_count,'error_count',i.error_count,'warning_count',i.warning_count,'mapping_version',i.mapping_version,'created_at',i.created_at,'published_at',i.published_at,'published_by',i.published_by) into v_import from public.imports i where i.id=p_import_id;
 select coalesce((select jsonb_agg(to_jsonb(r) order by r.updated_at desc) from public.import_reconciliations r where r.import_id=p_import_id and r.organization_id=v_org),'[]'::jsonb) into v_reconciliation;
 select coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'from_status',e.from_status,'to_status',e.to_status,'actor_id',e.actor_id,'metadata',e.metadata,'created_at',e.created_at) order by e.created_at desc) from public.import_audit_events e where e.import_id=p_import_id and e.organization_id=v_org),'[]'::jsonb) into v_audit;
 select coalesce((select jsonb_agg(jsonb_build_object('source_code',s.source_code,'source_name',s.source_name,'row_count',s.row_count,'mapping_id',m.id,'mapping_status',m.status,'target_account_id',m.target_account_id,'target_account_code',a.code,'target_account_name',a.name) order by s.source_code) from (select r.payload->>'account_code' source_code,max(r.payload->>'account_name') source_name,count(*)::integer row_count from public.import_rows r where r.import_id=p_import_id group by r.payload->>'account_code' order by count(*) desc limit 500) s left join public.account_mappings m on m.organization_id=v_org and m.mapping_version=coalesce((v_import->>'mapping_version'),'v1') and m.source_code=s.source_code left join public.accounts a on a.id=m.target_account_id and a.organization_id=v_org),'[]'::jsonb) into v_sources;
 select coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'code',a.code,'name',a.name,'account_type',a.account_type,'statement_type',a.statement_type,'statement_section',a.statement_section) order by a.code) from public.accounts a where a.organization_id=v_org limit 1000),'[]'::jsonb) into v_accounts;
 select coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'mapping_version',m.mapping_version,'source_code',m.source_code,'source_name',m.source_name,'target_account_id',m.target_account_id,'status',m.status,'created_by',m.created_by,'approved_by',m.approved_by,'approved_at',m.approved_at) order by m.mapping_version,m.source_code) from public.account_mappings m where m.organization_id=v_org and (m.mapping_version=coalesce((v_import->>'mapping_version'),'v1') or m.status='draft') limit 1000),'[]'::jsonb) into v_mappings;
 return jsonb_build_object('import',v_import,'reconciliation',v_reconciliation,'audit_events',v_audit,'sources',v_sources,'accounts',v_accounts,'mappings',v_mappings);
end; $$;

-- Mapping create/edit boundary with tenant validation.
create or replace function public.upsert_account_mapping(p_organization_id uuid,p_mapping_version text,p_source_code text,p_source_name text,p_target_account_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=(select auth.uid()); v_id uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not public.has_org_permission(p_organization_id,'mapping.create') and not public.has_org_permission(p_organization_id,'mapping.edit') then raise exception 'Mapping create or edit permission required'; end if;
 if not exists(select 1 from public.accounts a where a.id=p_target_account_id and a.organization_id=p_organization_id) then raise exception 'Target account does not belong to this organization'; end if;
 select id into v_id from public.account_mappings where organization_id=p_organization_id and mapping_version=btrim(p_mapping_version) and source_code=btrim(p_source_code) for update;
 if v_id is null then
   if not public.has_org_permission(p_organization_id,'mapping.create') then raise exception 'Mapping create permission required'; end if;
   insert into public.account_mappings(organization_id,mapping_version,source_code,source_name,target_account_id,status,created_by)
   values(p_organization_id,btrim(p_mapping_version),btrim(p_source_code),btrim(p_source_name),p_target_account_id,'draft',v_user) returning id into v_id;
   perform public.write_audit_event(p_organization_id,'mapping.create','account_mapping',v_id::text,null,jsonb_build_object('mapping_version',btrim(p_mapping_version),'source_code',btrim(p_source_code),'target_account_id',p_target_account_id));
 else
   if not public.has_org_permission(p_organization_id,'mapping.edit') then raise exception 'Mapping edit permission required'; end if;
   if exists(select 1 from public.account_mappings where id=v_id and status='approved') then raise exception 'Approved mapping is immutable; create a new mapping version'; end if;
   update public.account_mappings set source_name=btrim(p_source_name),target_account_id=p_target_account_id,status='draft',rejected_by=null,rejected_at=null,approved_by=null,approved_at=null,updated_at=now() where id=v_id;
   perform public.write_audit_event(p_organization_id,'mapping.edit','account_mapping',v_id::text,null,jsonb_build_object('mapping_version',btrim(p_mapping_version),'source_code',btrim(p_source_code),'target_account_id',p_target_account_id));
 end if;
 return v_id;
end; $$;

-- Mapping approve/reject boundary. Creator cannot approve their own mapping.
create or replace function public.review_account_mapping(p_mapping_id uuid,p_action text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=(select auth.uid()); v_mapping public.account_mappings%rowtype; v_before jsonb;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_action not in ('approve','reject') then raise exception 'Invalid mapping review action'; end if;
 select * into v_mapping from public.account_mappings where id=p_mapping_id for update;
 if not found then raise exception 'Mapping not found'; end if;
 if not public.has_org_permission(v_mapping.organization_id,'mapping.approve') then raise exception 'Mapping approval permission required'; end if;
 if v_mapping.status not in ('draft','rejected') then raise exception 'Only draft or rejected mappings can be reviewed'; end if;
 if p_action='approve' and v_mapping.created_by=v_user then raise exception 'Mapping creator cannot approve the same mapping'; end if;
 v_before:=to_jsonb(v_mapping);
 if p_action='approve' then
   update public.account_mappings set status='approved',approved_by=v_user,approved_at=now(),rejected_by=null,rejected_at=null,updated_at=now() where id=p_mapping_id;
 else
   update public.account_mappings set status='rejected',rejected_by=v_user,rejected_at=now(),approved_by=null,approved_at=null,updated_at=now() where id=p_mapping_id;
 end if;
 perform public.write_audit_event(v_mapping.organization_id,'mapping.'||p_action,'account_mapping',p_mapping_id::text,v_before,(select to_jsonb(x) from public.account_mappings x where x.id=p_mapping_id));
 return p_mapping_id;
end; $$;

-- Delete is restricted to draft/rejected mappings only.
create or replace function public.delete_account_mapping(p_mapping_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=(select auth.uid()); v_mapping public.account_mappings%rowtype;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into v_mapping from public.account_mappings where id=p_mapping_id for update;
 if not found then raise exception 'Mapping not found'; end if;
 if not public.has_org_permission(v_mapping.organization_id,'mapping.delete') then raise exception 'Mapping delete permission required'; end if;
 if v_mapping.status not in ('draft','rejected') then raise exception 'Only draft or rejected mappings can be deleted'; end if;
 delete from public.account_mappings where id=p_mapping_id;
 perform public.write_audit_event(v_mapping.organization_id,'mapping.delete','account_mapping',p_mapping_id::text,to_jsonb(v_mapping),null);
 return p_mapping_id;
end; $$;

-- Actuals publication now uses the granular permission rather than legacy submit/import checks.
create or replace function public.publish_actuals_from_import(p_import_id uuid,p_mapping_version text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=(select auth.uid()); v_org uuid; v_status text; v_mapping text; v_batch_id uuid; v_rows integer; v_bad integer; v_existing uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select organization_id,status,mapping_version into v_org,v_status,v_mapping from public.imports where id=p_import_id for update;
 if v_org is null then raise exception 'Import not found'; end if;
 if not public.has_org_permission(v_org,'actuals.publish') then raise exception 'Actuals publish permission required'; end if;
 if not public.has_org_permission(v_org,'mapping.view') then raise exception 'Mapping view permission required'; end if;
 if p_mapping_version is null or btrim(p_mapping_version)='' then raise exception 'Mapping version is required'; end if;
 if v_status not in ('ready_for_review','reconciled') then raise exception 'Import is not ready for publishing'; end if;
 if v_mapping is null or btrim(v_mapping)<>btrim(p_mapping_version) then raise exception 'Mapping version mismatch'; end if;
 if exists(select 1 from public.actuals_publish_batches b where b.import_id=p_import_id and b.organization_id=v_org and b.status='published') then select b.id into v_existing from public.actuals_publish_batches b where b.import_id=p_import_id and b.organization_id=v_org and b.status='published' order by b.published_at desc limit 1; return v_existing; end if;
 select count(*),count(*) filter(where validation_status<>'valid') into v_rows,v_bad from public.import_rows where import_id=p_import_id;
 if v_rows=0 or v_bad>0 then raise exception 'Import contains invalid rows'; end if;
 if exists(select 1 from public.import_rows r left join public.account_mappings m on m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.source_code=(r.payload->>'account_code') and m.status='approved' where r.import_id=p_import_id and m.id is null) then raise exception 'Approved mapping coverage is incomplete'; end if;
 insert into public.actuals_publish_batches(organization_id,import_id,mapping_version,status,published_by,published_at) values(v_org,p_import_id,btrim(p_mapping_version),'published',v_user,now()) returning id into v_batch_id;
 insert into public.financial_facts(organization_id,source_import_id,source_batch_id,fact_type,financial_date,account_id,amount_minor,description,created_by)
 select v_org,p_import_id,v_batch_id,'actual',(r.payload->>'date')::date,m.target_account_id,round(((coalesce(nullif(r.payload->>'debit','')::numeric,0)-coalesce(nullif(r.payload->>'credit','')::numeric,0))*100))::bigint,r.payload->>'account_name',v_user
 from public.import_rows r join public.account_mappings m on m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.source_code=(r.payload->>'account_code') and m.status='approved' where r.import_id=p_import_id;
 update public.imports set status='published',published_at=now(),published_by=v_user,imported_row_count=v_rows where id=p_import_id;
 perform public.write_audit_event(v_org,'actuals.publish','import',p_import_id::text,null,jsonb_build_object('batch_id',v_batch_id,'mapping_version',btrim(p_mapping_version),'row_count',v_rows));
 return v_batch_id;
end; $$;

revoke all on function public.get_import_review(uuid) from public,anon;
revoke all on function public.upsert_account_mapping(uuid,text,text,text,uuid) from public,anon;
revoke all on function public.review_account_mapping(uuid,text) from public,anon;
revoke all on function public.delete_account_mapping(uuid) from public,anon;
revoke all on function public.publish_actuals_from_import(uuid,text) from public,anon;
grant execute on function public.get_import_review(uuid) to authenticated;
grant execute on function public.upsert_account_mapping(uuid,text,text,text,uuid) to authenticated;
grant execute on function public.review_account_mapping(uuid,text) to authenticated;
grant execute on function public.delete_account_mapping(uuid) to authenticated;
grant execute on function public.publish_actuals_from_import(uuid,text) to authenticated;
