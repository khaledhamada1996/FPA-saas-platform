-- Journal management: list, inspect, and versioned amendment of published actual journals.
create or replace function public.get_journal_entries(p_organization_id uuid,p_start_date date default null,p_end_date date default null,p_journal_no text default null,p_account_id uuid default null,p_branch_id uuid default null,p_department_id uuid default null,p_cost_center_id uuid default null,p_region_id uuid default null,p_product_id uuid default null,p_project_id uuid default null,p_limit integer default 100,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_rows jsonb; v_total integer;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not public.has_org_permission(p_organization_id,'actuals.view') then raise exception 'Actuals view permission required'; end if;
 if not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=v_user) then raise exception 'Organization membership required'; end if;
 with scoped as (
  select f.journal_no,min(f.transaction_date) transaction_date,min(f.description) description,sum(coalesce(f.debit_minor,0)) debit_minor,sum(coalesce(f.credit_minor,0)) credit_minor,count(*) line_count,max(f.version_no) version_no
  from public.financial_facts f
  where f.organization_id=p_organization_id and f.fact_type='actual' and f.status='published' and f.superseded_by is null
   and (p_start_date is null or f.transaction_date>=p_start_date) and (p_end_date is null or f.transaction_date<=p_end_date)
   and (p_journal_no is null or btrim(p_journal_no)='' or f.journal_no ilike '%'||btrim(p_journal_no)||'%')
   and (p_account_id is null or f.account_id=p_account_id) and (p_branch_id is null or f.branch_id=p_branch_id)
   and (p_department_id is null or f.department_id=p_department_id) and (p_cost_center_id is null or f.cost_center_id=p_cost_center_id)
   and (p_region_id is null or f.region_id=p_region_id) and (p_product_id is null or f.product_id=p_product_id) and (p_project_id is null or f.project_id=p_project_id)
   and public.has_org_data_scope(f.organization_id,'legal_entity',f.legal_entity_id) and public.has_org_data_scope(f.organization_id,'branch',f.branch_id)
   and public.has_org_data_scope(f.organization_id,'department',f.department_id) and public.has_org_data_scope(f.organization_id,'cost_center',f.cost_center_id)
   and public.has_org_data_scope(f.organization_id,'region',f.region_id) and public.has_org_data_scope(f.organization_id,'product',f.product_id) and public.has_org_data_scope(f.organization_id,'project',f.project_id)
  group by f.journal_no), counted as (select count(*) n from scoped)
 select coalesce(jsonb_agg(to_jsonb(x) order by x.transaction_date,x.journal_no),'[]'::jsonb), (select n from counted) into v_rows,v_total
 from (select * from scoped order by transaction_date,journal_no limit greatest(1,least(500,p_limit)) offset greatest(0,p_offset)) x;
 return jsonb_build_object('rows',v_rows,'total',coalesce(v_total,0),'limit',p_limit,'offset',p_offset);
end $$;
create or replace function public.get_journal_entry(p_organization_id uuid,p_journal_no text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_lines jsonb;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not public.has_org_permission(p_organization_id,'actuals.view') then raise exception 'Actuals view permission required'; end if;
 if not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=v_user) then raise exception 'Organization membership required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'date',f.transaction_date,'journal_no',f.journal_no,'description',f.description,'account_id',f.account_id,'account_code',a.code,'account_name',a.name,'debit',coalesce(f.debit_minor,0),'credit',coalesce(f.credit_minor,0),'currency',f.currency,'branch_id',f.branch_id,'department_id',f.department_id,'cost_center_id',f.cost_center_id,'region_id',f.region_id,'product_id',f.product_id,'project_id',f.project_id,'version_no',f.version_no) order by f.id),'[]'::jsonb) into v_lines
 from public.financial_facts f join public.accounts a on a.id=f.account_id and a.organization_id=p_organization_id
 where f.organization_id=p_organization_id and f.fact_type='actual' and f.status='published' and f.superseded_by is null and f.journal_no=btrim(p_journal_no);
 if jsonb_array_length(v_lines)=0 then raise exception 'Journal entry not found'; end if;
 return jsonb_build_object('journal_no',btrim(p_journal_no),'lines',v_lines);
end $$;
create or replace function public.amend_journal_entry(p_organization_id uuid,p_journal_no text,p_lines jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_import uuid:=gen_random_uuid(); v_batch uuid:=gen_random_uuid(); v_old integer; v_n integer:=0; v_d bigint:=0; v_c bigint:=0; r jsonb; d bigint; c bigint; dt date; aid uuid; pid uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not public.has_org_permission(p_organization_id,'actuals.publish') then raise exception 'Actuals edit/publish permission required'; end if;
 if not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=v_user) then raise exception 'Organization membership required'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then raise exception 'Journal must contain at least two lines'; end if;
 select count(*) into v_old from public.financial_facts f where f.organization_id=p_organization_id and f.fact_type='actual' and f.status='published' and f.superseded_by is null and f.journal_no=btrim(p_journal_no);
 if v_old=0 then raise exception 'Journal entry not found'; end if;
 insert into public.imports(id,organization_id,file_name,file_hash,status,row_count,imported_row_count,error_count,warning_count,created_by,published_at,published_by,input_type)
 values(v_import,p_organization_id,'journal-amendment-'||btrim(p_journal_no),encode(extensions.digest(convert_to(p_lines::text,'UTF8'),'sha256'),'hex'),'published',jsonb_array_length(p_lines),jsonb_array_length(p_lines),0,0,v_user,now(),v_user,'manual');
 insert into public.actuals_publish_batches(id,organization_id,import_id,mapping_version,status,row_count,published_at,published_by)
 values(v_batch,p_organization_id,v_import,'journal-amendment','published',jsonb_array_length(p_lines),now(),v_user);
 for r in select value from jsonb_array_elements(p_lines) loop
  dt:=(r->>'date')::date; aid:=(r->>'account_id')::uuid; d:=round(coalesce(nullif(r->>'debit','')::numeric,0))::bigint; c:=round(coalesce(nullif(r->>'credit','')::numeric,0))::bigint;
  if dt is null or aid is null or d<0 or c<0 or (d>0 and c>0) or (d=0 and c=0) then raise exception 'Invalid journal line'; end if;
  select id into pid from public.financial_periods where organization_id=p_organization_id and dt between period_start and period_end limit 1;
  if pid is null then raise exception 'Financial period not found'; end if;
  if not exists(select 1 from public.accounts where id=aid and organization_id=p_organization_id) then raise exception 'Account does not belong to organization'; end if;
  v_d:=v_d+d; v_c:=v_c+c; v_n:=v_n+1;
  insert into public.financial_facts(id,organization_id,financial_period_id,account_id,currency,amount_minor,fact_type,source_import_id,source_batch_id,journal_no,description,debit_minor,credit_minor,transaction_date,version_no,status,record_hash,branch_id,department_id,cost_center_id,region_id,product_id,project_id)
  values(gen_random_uuid(),p_organization_id,pid,aid,coalesce(nullif(r->>'currency',''),'SAR')::bpchar,d-c,'actual',v_import,v_batch,btrim(p_journal_no),nullif(r->>'description',''),d,c,dt,coalesce((select max(version_no)+1 from public.financial_facts where organization_id=p_organization_id and journal_no=btrim(p_journal_no)),1),'published',encode(extensions.digest(convert_to(r::text,'UTF8'),'sha256'),'hex'),nullif(r->>'branch_id','')::uuid,nullif(r->>'department_id','')::uuid,nullif(r->>'cost_center_id','')::uuid,nullif(r->>'region_id','')::uuid,nullif(r->>'product_id','')::uuid,nullif(r->>'project_id','')::uuid);
 end loop;
 if v_d<>v_c then raise exception 'Journal is not balanced'; end if;
 update public.financial_facts set status='superseded',fact_type='actual_superseded',superseded_by=v_batch,superseded_at=now() where organization_id=p_organization_id and fact_type='actual' and status='published' and superseded_by is null and journal_no=btrim(p_journal_no);
 perform public.write_audit_event(p_organization_id,'actuals.journal.amend','journal_entry',btrim(p_journal_no),jsonb_build_object('old_line_count',v_old),jsonb_build_object('new_line_count',v_n,'batch_id',v_batch,'versioned',true));
 return v_batch;
end $$;
revoke all on function public.get_journal_entries(uuid,date,date,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer) from public,anon;
grant execute on function public.get_journal_entries(uuid,date,date,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer) to authenticated;
revoke all on function public.get_journal_entry(uuid,text) from public,anon;
grant execute on function public.get_journal_entry(uuid,text) to authenticated;
revoke all on function public.amend_journal_entry(uuid,text,jsonb) from public,anon;
grant execute on function public.amend_journal_entry(uuid,text,jsonb) to authenticated;
