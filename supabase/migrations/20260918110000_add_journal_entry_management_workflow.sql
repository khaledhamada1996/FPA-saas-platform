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
declare
 v_user uuid:=auth.uid(); v_import uuid:=gen_random_uuid(); v_batch uuid:=gen_random_uuid();
 v_old integer; v_n integer:=0; v_d bigint:=0; v_c bigint:=0; v_version integer; r jsonb;
 d bigint; c bigint; dt date; aid uuid; pid uuid; v_status text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not public.has_org_permission(p_organization_id,'actuals.publish') then raise exception 'Actuals edit/publish permission required'; end if;
 if not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=v_user) then raise exception 'Organization membership required'; end if;
 if p_journal_no is null or btrim(p_journal_no)='' then raise exception 'Journal number is required'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then raise exception 'Journal must contain at least two lines'; end if;
 select count(*) into v_old from public.financial_facts f
 where f.organization_id=p_organization_id and f.fact_type='actual' and f.status='published' and f.superseded_by is null and f.journal_no=btrim(p_journal_no)
   and public.has_org_data_scope(f.organization_id,'legal_entity',f.legal_entity_id)
   and public.has_org_data_scope(f.organization_id,'branch',f.branch_id)
   and public.has_org_data_scope(f.organization_id,'department',f.department_id)
   and public.has_org_data_scope(f.organization_id,'cost_center',f.cost_center_id)
   and public.has_org_data_scope(f.organization_id,'region',f.region_id)
   and public.has_org_data_scope(f.organization_id,'product',f.product_id)
   and public.has_org_data_scope(f.organization_id,'project',f.project_id);
 if v_old=0 then raise exception 'Journal entry not found'; end if;
 select max(f.version_no)+1 into v_version from public.financial_facts f where f.organization_id=p_organization_id and f.journal_no=btrim(p_journal_no);
 v_version:=coalesce(v_version,1);
 for r in select value from jsonb_array_elements(p_lines) loop
   dt:=(r->>'date')::date; aid:=(r->>'account_id')::uuid;
   d:=round(coalesce(nullif(r->>'debit','')::numeric,0))::bigint;
   c:=round(coalesce(nullif(r->>'credit','')::numeric,0))::bigint;
   if dt is null or aid is null or d<0 or c<0 or (d>0 and c>0) or (d=0 and c=0) then raise exception 'Invalid journal line'; end if;
   select id,status into pid,v_status from public.financial_periods where organization_id=p_organization_id and dt between period_start and period_end limit 1;
   if pid is null then raise exception 'Financial period not found'; end if;
   if lower(coalesce(v_status,'')) in ('locked','closed','finalized') then raise exception 'Financial period is locked'; end if;
   if not exists(select 1 from public.accounts where id=aid and organization_id=p_organization_id) then raise exception 'Account does not belong to organization'; end if;
   if not public.has_org_data_scope(p_organization_id,'legal_entity',nullif(r->>'legal_entity_id','')::uuid)
      or not public.has_org_data_scope(p_organization_id,'branch',nullif(r->>'branch_id','')::uuid)
      or not public.has_org_data_scope(p_organization_id,'department',nullif(r->>'department_id','')::uuid)
      or not public.has_org_data_scope(p_organization_id,'cost_center',nullif(r->>'cost_center_id','')::uuid)
      or not public.has_org_data_scope(p_organization_id,'region',nullif(r->>'region_id','')::uuid)
      or not public.has_org_data_scope(p_organization_id,'product',nullif(r->>'product_id','')::uuid)
      or not public.has_org_data_scope(p_organization_id,'project',nullif(r->>'project_id','')::uuid) then raise exception 'Journal line is outside permitted data scope'; end if;
   v_d:=v_d+d; v_c:=v_c+c;
 end loop;
 if v_d<>v_c then raise exception 'Journal is not balanced'; end if;
 insert into public.imports(id,organization_id,file_name,file_hash,status,row_count,imported_row_count,error_count,warning_count,created_by,published_at,published_by,input_type)
 values(v_import,p_organization_id,'journal-amendment-'||btrim(p_journal_no),encode(extensions.digest(convert_to(p_lines::text,'UTF8'),'sha256'),'hex'),'published',jsonb_array_length(p_lines),jsonb_array_length(p_lines),0,0,v_user,now(),v_user,'manual');
 insert into public.actuals_publish_batches(id,organization_id,import_id,mapping_version,status,row_count,published_at,published_by)
 values(v_batch,p_organization_id,v_import,'journal-amendment','published',jsonb_array_length(p_lines),now(),v_user);
 for r in select value from jsonb_array_elements(p_lines) loop
   dt:=(r->>'date')::date; aid:=(r->>'account_id')::uuid;
   d:=round(coalesce(nullif(r->>'debit','')::numeric,0))::bigint;
   c:=round(coalesce(nullif(r->>'credit','')::numeric,0))::bigint;
   select id into pid from public.financial_periods where organization_id=p_organization_id and dt between period_start and period_end limit 1;
   insert into public.financial_facts(id,organization_id,financial_period_id,account_id,currency,amount_minor,fact_type,source_import_id,source_batch_id,journal_no,description,debit_minor,credit_minor,transaction_date,version_no,status,record_hash,legal_entity_id,branch_id,department_id,cost_center_id,region_id,product_id,project_id)
   values(gen_random_uuid(),p_organization_id,pid,aid,coalesce(nullif(r->>'currency',''),'SAR')::bpchar,d-c,'actual',v_import,v_batch,btrim(p_journal_no),nullif(r->>'description',''),d,c,dt,v_version,'published',encode(extensions.digest(convert_to(r::text,'UTF8'),'sha256'),'hex'),nullif(r->>'legal_entity_id','')::uuid,nullif(r->>'branch_id','')::uuid,nullif(r->>'department_id','')::uuid,nullif(r->>'cost_center_id','')::uuid,nullif(r->>'region_id','')::uuid,nullif(r->>'product_id','')::uuid,nullif(r->>'project_id','')::uuid);
   v_n:=v_n+1;
 end loop;
 update public.financial_facts f set status='superseded',fact_type='actual_superseded',superseded_by=v_batch,superseded_at=now()
 where f.organization_id=p_organization_id and f.fact_type='actual' and f.status='published' and f.superseded_by is null and f.journal_no=btrim(p_journal_no);
 perform public.write_audit_event(p_organization_id,'actuals.journal.amend','journal_entry',btrim(p_journal_no),jsonb_build_object('old_line_count',v_old,'old_version',v_version-1),jsonb_build_object('new_line_count',v_n,'new_version',v_version,'batch_id',v_batch,'versioned',true));
 return v_batch;
end $$;
revoke all on function public.get_journal_entries(uuid,date,date,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer) from public,anon;
grant execute on function public.get_journal_entries(uuid,date,date,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer) to authenticated;
revoke all on function public.get_journal_entry(uuid,text) from public,anon;
grant execute on function public.get_journal_entry(uuid,text) to authenticated;
revoke all on function public.amend_journal_entry(uuid,text,jsonb) from public,anon;
grant execute on function public.amend_journal_entry(uuid,text,jsonb) to authenticated;


-- Direct manual journal creation: validate, publish, and retain a complete import/batch audit trail.
create or replace function public.create_manual_journal_entry(
  p_organization_id uuid,
  p_lines jsonb
) returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_import_id uuid;
  v_batch_id uuid;
  v_row_count integer;
  v_bad integer;
  v_unbalanced numeric;
  v_journal_no text;
  v_org uuid;
  v_currency char(3);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_organization_id is null then raise exception 'Organization is required'; end if;
  if not public.has_org_permission(p_organization_id,'actuals.publish') then
    raise exception 'Journal entry permission required';
  end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'Lines must be a JSON array'; end if;
  v_row_count := jsonb_array_length(p_lines);
  if v_row_count < 2 then raise exception 'Journal entry requires at least two lines'; end if;
  if v_row_count > 500 then raise exception 'Journal entry exceeds the line limit'; end if;

  select o.id,o.base_currency into v_org,v_currency
  from public.organizations o where o.id=p_organization_id;
  if v_org is null then raise exception 'Organization not found'; end if;

  with parsed as (
    select nullif(btrim(x.elem->>'date'),'')::date tx_date,
      nullif(btrim(x.elem->>'journal_no'),'') journal_no,
      nullif(btrim(x.elem->>'description'),'') description,
      nullif(btrim(x.elem->>'account_id'),'')::uuid account_id,
      case when coalesce(x.elem->>'debit','') ~ '^[0-9]+([.][0-9]+)?$' then (x.elem->>'debit')::numeric else null end debit,
      case when coalesce(x.elem->>'credit','') ~ '^[0-9]+([.][0-9]+)?$' then (x.elem->>'credit')::numeric else null end credit
    from jsonb_array_elements(p_lines) x(elem)
  )
  select count(*) into v_bad from parsed p
  where p.tx_date is null or p.journal_no is null or p.description is null or p.account_id is null
    or p.debit is null or p.credit is null or p.debit < 0 or p.credit < 0
    or (p.debit > 0 and p.credit > 0) or (p.debit = 0 and p.credit = 0);
  if v_bad > 0 then raise exception 'Journal contains % invalid lines',v_bad; end if;

  select min(journal_no), count(distinct journal_no) into v_journal_no, v_bad
  from (select nullif(btrim(elem->>'journal_no'),'') journal_no from jsonb_array_elements(p_lines) x(elem)) q;
  if v_bad <> 1 then raise exception 'All journal lines must use the same journal number'; end if;

  select abs(sum(coalesce(nullif(elem->>'debit','')::numeric,0)-coalesce(nullif(elem->>'credit','')::numeric,0)))
    into v_unbalanced from jsonb_array_elements(p_lines) x(elem);
  if coalesce(v_unbalanced,0) > 0.005 then raise exception 'Journal is not balanced'; end if;

  if exists (
    select 1 from public.financial_facts ff
    where ff.organization_id=p_organization_id and ff.journal_no=v_journal_no
      and ff.fact_type='actual' and ff.status='published' and ff.superseded_by is null
  ) then
    raise exception 'Journal number already exists; use the journal amendment screen to edit it';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_lines) x(elem)
    left join public.accounts a on a.id=nullif(btrim(x.elem->>'account_id'),'')::uuid and a.organization_id=p_organization_id
    where a.id is null
  ) then raise exception 'Every journal line must reference an account from the active organization'; end if;

  if exists (
    select 1 from (select distinct date_trunc('month',(elem->>'date')::date)::date period_start
                   from jsonb_array_elements(p_lines) x(elem)) d
    join public.financial_periods fp on fp.organization_id=p_organization_id
      and fp.period_start=d.period_start and fp.status in ('locked','closed','finalized')
  ) then raise exception 'Journal contains transactions in a locked financial period'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_lines) x(elem)
    where not public.has_org_data_scope(p_organization_id,'legal_entity',nullif(x.elem->>'legal_entity_id','')::uuid)
       or not public.has_org_data_scope(p_organization_id,'branch',nullif(x.elem->>'branch_id','')::uuid)
       or not public.has_org_data_scope(p_organization_id,'department',nullif(x.elem->>'department_id','')::uuid)
       or not public.has_org_data_scope(p_organization_id,'cost_center',nullif(x.elem->>'cost_center_id','')::uuid)
       or not public.has_org_data_scope(p_organization_id,'region',nullif(x.elem->>'region_id','')::uuid)
       or not public.has_org_data_scope(p_organization_id,'product',nullif(x.elem->>'product_id','')::uuid)
       or not public.has_org_data_scope(p_organization_id,'project',nullif(x.elem->>'project_id','')::uuid)
  ) then raise exception 'Journal line is outside permitted data scope'; end if;

  insert into public.imports(organization_id,file_name,file_hash,input_type,status,row_count,imported_row_count,error_count,warning_count,created_by,published_at,mapping_version,published_by)
  values(p_organization_id,'manual-journal-'||v_journal_no,
    encode(sha256(convert_to(p_lines::text,'UTF8')),'hex'),
    'actual_journal_transactions','published',v_row_count,v_row_count,0,0,v_user,now(),'manual',v_user)
  returning id into v_import_id;

  insert into public.financial_periods(organization_id,period_start,period_end,status)
  select p_organization_id,d.period_start,(d.period_start+interval '1 month - 1 day')::date,'open'
  from (select distinct date_trunc('month',(elem->>'date')::date)::date period_start
        from jsonb_array_elements(p_lines) x(elem)) d
  on conflict(organization_id,period_start) do nothing;

  insert into public.actuals_publish_batches(organization_id,import_id,mapping_version,status,row_count,published_at,published_by)
  values(p_organization_id,v_import_id,'manual','published',v_row_count,now(),v_user)
  returning id into v_batch_id;

  insert into public.financial_facts(
    organization_id,financial_period_id,account_id,legal_entity_id,branch_id,department_id,cost_center_id,region_id,product_id,project_id,
    currency,amount_minor,fact_type,source_import_id,source_row_key,journal_no,description,debit_minor,credit_minor,transaction_date,status,version_no,superseded_by,superseded_at,source_batch_id)
  select p_organization_id,fp.id,nullif(btrim(x.elem->>'account_id'),'')::uuid,
    nullif(x.elem->>'legal_entity_id','')::uuid,nullif(x.elem->>'branch_id','')::uuid,nullif(x.elem->>'department_id','')::uuid,
    nullif(x.elem->>'cost_center_id','')::uuid,nullif(x.elem->>'region_id','')::uuid,nullif(x.elem->>'product_id','')::uuid,nullif(x.elem->>'project_id','')::uuid,
    v_currency,
    round((coalesce(nullif(x.elem->>'debit','')::numeric,0)-coalesce(nullif(x.elem->>'credit','')::numeric,0))*100)::bigint,
    'actual',v_import_id,
    v_import_id::text||':'||((x.elem->>'line_no')::integer),
    v_journal_no,x.elem->>'description',
    round(coalesce(nullif(x.elem->>'debit','')::numeric,0)*100)::bigint,
    round(coalesce(nullif(x.elem->>'credit','')::numeric,0)*100)::bigint,
    (x.elem->>'date')::date,'published',1,null,null,v_batch_id
  from jsonb_array_elements(p_lines) x(elem)
  join public.financial_periods fp on fp.organization_id=p_organization_id
    and fp.period_start=date_trunc('month',(x.elem->>'date')::date)::date;

  insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata)
  values(p_organization_id,v_import_id,v_user,'manual_create',null,'published',
    jsonb_build_object('journal_no',v_journal_no,'row_count',v_row_count,'source','manual_journal'));

  return v_batch_id;
end;
$function$;

revoke all on function public.create_manual_journal_entry(uuid,jsonb) from public,anon;
grant execute on function public.create_manual_journal_entry(uuid,jsonb) to authenticated;
