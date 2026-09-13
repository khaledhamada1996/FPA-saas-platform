create table if not exists public.master_data_import_batches(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,input_type text not null check(input_type in('legal_entities','branches','departments','cost_centers','regions','products','projects')),file_name text not null,status text not null default 'draft' check(status in('draft','validated','applied','failed','cancelled')),row_count integer not null default 0,accepted_count integer not null default 0,rejected_count integer not null default 0,error_count integer not null default 0,created_by uuid not null default auth.uid(),applied_at timestamptz,applied_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.master_data_import_rows(id uuid primary key default gen_random_uuid(),batch_id uuid not null references public.master_data_import_batches(id) on delete cascade,row_number integer not null,source_payload jsonb not null,validation_status text not null default 'pending' check(validation_status in('pending','valid','error')),validation_errors jsonb not null default '[]'::jsonb,created_at timestamptz not null default now(),unique(batch_id,row_number));
create index if not exists idx_master_data_import_batches_org_created on public.master_data_import_batches(organization_id,created_at desc);
create index if not exists idx_master_data_import_rows_batch_status on public.master_data_import_rows(batch_id,validation_status,row_number);
alter table public.master_data_import_batches enable row level security;
alter table public.master_data_import_rows enable row level security;
drop policy if exists master_data_import_batches_deny on public.master_data_import_batches;
create policy master_data_import_batches_deny on public.master_data_import_batches for all to authenticated using(false) with check(false);
drop policy if exists master_data_import_rows_deny on public.master_data_import_rows;
create policy master_data_import_rows_deny on public.master_data_import_rows for all to authenticated using(false) with check(false);
revoke all on public.master_data_import_batches,public.master_data_import_rows from anon,authenticated;
insert into public.organization_permissions(permission_key,name,description,category) values('master_data_import.view','عرض استيراد البيانات الأساسية','عرض دفعات ونتائج استيراد البيانات الأساسية','data'),('master_data_import.create','إنشاء استيراد البيانات الأساسية','رفع وتجهيز دفعة بيانات أساسية','data'),('master_data_import.apply','تطبيق استيراد البيانات الأساسية','تطبيق البيانات المعتمدة على البيانات الأساسية','data') on conflict(permission_key) do nothing;
insert into public.organization_role_permissions(organization_id,role_key,permission_key) select om.organization_id,om.role_key,p.permission_key from public.organization_members om join public.organization_permissions p on p.permission_key like 'master_data_import.%' join public.organization_roles r on r.organization_id=om.organization_id and r.role_key=om.role_key where r.hierarchy_level>=90 on conflict do nothing;
create or replace function public.create_master_data_import_batch(p_organization_id uuid,p_input_type text,p_file_name text,p_rows jsonb) returns uuid language plpgsql security definer set search_path='' as $fn$
declare v_batch uuid; v_row jsonb; v_i int:=0; v_errors jsonb; v_code text; v_name text; v_legal text;
begin
 if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_organization_id,'master_data_import.create') then raise exception 'PERMISSION_DENIED'; end if;
 if p_input_type not in('legal_entities','branches','departments','cost_centers','regions','products','projects') then raise exception 'UNSUPPORTED_INPUT_TYPE'; end if;
 if p_file_name is null or length(trim(p_file_name))=0 then raise exception 'FILE_NAME_REQUIRED'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>10000 then raise exception 'INVALID_ROW_COUNT'; end if;
 insert into public.master_data_import_batches(organization_id,input_type,file_name,row_count,created_by) values(p_organization_id,p_input_type,p_file_name,jsonb_array_length(p_rows),(select auth.uid())) returning id into v_batch;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  v_i:=v_i+1; v_errors:='[]'::jsonb; v_code:=nullif(trim(coalesce(v_row->>'code','')),''); v_name:=nullif(trim(coalesce(v_row->>'name','')),'');
  if v_code is null then v_errors:=v_errors||jsonb_build_array('CODE_REQUIRED'); end if;
  if v_name is null then v_errors:=v_errors||jsonb_build_array('NAME_REQUIRED'); end if;
  if p_input_type='branches' then
   v_legal:=nullif(trim(coalesce(v_row->>'legal_entity_code','')),'');
   if v_legal is null then v_errors:=v_errors||jsonb_build_array('LEGAL_ENTITY_CODE_REQUIRED'); else if not exists(select 1 from public.legal_entities where organization_id=p_organization_id and code=v_legal) then v_errors:=v_errors||jsonb_build_array('LEGAL_ENTITY_NOT_FOUND'); end if; end if;
  end if;
  if p_input_type='legal_entities' and nullif(trim(coalesce(v_row->>'currency','')),'') is not null then if length(trim(v_row->>'currency'))<>3 then v_errors:=v_errors||jsonb_build_array('INVALID_CURRENCY'); end if; end if;
  if v_code is not null and (select count(*) from jsonb_array_elements(p_rows) x where nullif(trim(coalesce(x->>'code','')),'')=v_code)>1 then v_errors:=v_errors||jsonb_build_array('DUPLICATE_CODE_IN_FILE'); end if;
  insert into public.master_data_import_rows(batch_id,row_number,source_payload,validation_status,validation_errors) values(v_batch,v_i,v_row,case when jsonb_array_length(v_errors)=0 then 'valid' else 'error' end,v_errors);
 end loop;
 update public.master_data_import_batches set accepted_count=(select count(*) from public.master_data_import_rows where batch_id=v_batch and validation_status='valid'),rejected_count=(select count(*) from public.master_data_import_rows where batch_id=v_batch and validation_status='error'),error_count=(select count(*) from public.master_data_import_rows where batch_id=v_batch and validation_status='error'),status=case when exists(select 1 from public.master_data_import_rows where batch_id=v_batch and validation_status='error') then 'draft' else 'validated' end,updated_at=now() where id=v_batch;
 return v_batch;
end;$fn$;
create or replace function public.get_master_data_import_batch(p_batch_id uuid) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_org uuid;
begin
 if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
 select organization_id into v_org from public.master_data_import_batches where id=p_batch_id;
 if v_org is null then raise exception 'BATCH_NOT_FOUND'; end if;
 if not public.has_org_permission(v_org,'master_data_import.view') then raise exception 'PERMISSION_DENIED'; end if;
 return (select jsonb_build_object('batch',to_jsonb(b),'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.row_number) from public.master_data_import_rows r where r.batch_id=b.id),'[]'::jsonb)) from public.master_data_import_batches b where b.id=p_batch_id);
end;$fn$;
create or replace function public.apply_master_data_import_batch(p_batch_id uuid) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare b public.master_data_import_batches%rowtype; r record; v_org uuid; v_legal uuid; v_active boolean; v_currency text; v_applied int:=0;
begin
 if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into b from public.master_data_import_batches where id=p_batch_id for update;
 if b.id is null then raise exception 'BATCH_NOT_FOUND'; end if; v_org:=b.organization_id;
 if not public.has_org_permission(v_org,'master_data_import.apply') then raise exception 'PERMISSION_DENIED'; end if;
 if b.status<>'validated' or b.error_count<>0 then raise exception 'BATCH_NOT_READY'; end if;
 for r in select * from public.master_data_import_rows where batch_id=b.id order by row_number loop
  if b.input_type='legal_entities' then
   v_currency:=coalesce(nullif(trim(r.source_payload->>'currency'),''),'SAR');
   insert into public.legal_entities(organization_id,name,code,currency) values(v_org,trim(r.source_payload->>'name'),trim(r.source_payload->>'code'),v_currency::char(3)) on conflict(organization_id,code) do update set name=excluded.name,currency=excluded.currency;
  elsif b.input_type='branches' then
   select id into v_legal from public.legal_entities where organization_id=v_org and code=trim(r.source_payload->>'legal_entity_code');
   if v_legal is null then raise exception 'LEGAL_ENTITY_NOT_FOUND_ROW_%',r.row_number; end if;
   v_active:=coalesce(nullif(trim(r.source_payload->>'is_active'),'')::boolean,true);
   insert into public.branches(organization_id,legal_entity_id,name,code,country,city,address,branch_type,registration_number,tax_id,contact_phone,contact_email,manager_name,is_active) values(v_org,v_legal,trim(r.source_payload->>'name'),trim(r.source_payload->>'code'),nullif(trim(r.source_payload->>'country'),''),nullif(trim(r.source_payload->>'city'),''),nullif(trim(r.source_payload->>'address'),''),nullif(trim(r.source_payload->>'branch_type'),''),nullif(trim(r.source_payload->>'registration_number'),''),nullif(trim(r.source_payload->>'tax_id'),''),nullif(trim(r.source_payload->>'contact_phone'),''),nullif(trim(r.source_payload->>'contact_email'),''),nullif(trim(r.source_payload->>'manager_name'),''),v_active) on conflict(organization_id,code) do update set legal_entity_id=excluded.legal_entity_id,name=excluded.name,country=excluded.country,city=excluded.city,address=excluded.address,branch_type=excluded.branch_type,registration_number=excluded.registration_number,tax_id=excluded.tax_id,contact_phone=excluded.contact_phone,contact_email=excluded.contact_email,manager_name=excluded.manager_name,is_active=excluded.is_active;
  elsif b.input_type='departments' then
   insert into public.departments(organization_id,name,code) values(v_org,trim(r.source_payload->>'name'),trim(r.source_payload->>'code')) on conflict(organization_id,code) do update set name=excluded.name;
  elsif b.input_type='cost_centers' then
   insert into public.cost_centers(organization_id,name,code) values(v_org,trim(r.source_payload->>'name'),trim(r.source_payload->>'code')) on conflict(organization_id,code) do update set name=excluded.name;
  elsif b.input_type='regions' then
   insert into public.regions(organization_id,name,code) values(v_org,trim(r.source_payload->>'name'),trim(r.source_payload->>'code')) on conflict(organization_id,code) do update set name=excluded.name;
  elsif b.input_type='products' then
   insert into public.products(organization_id,name,code) values(v_org,trim(r.source_payload->>'name'),trim(r.source_payload->>'code')) on conflict(organization_id,code) do update set name=excluded.name;
  elsif b.input_type='projects' then
   insert into public.projects(organization_id,name,code) values(v_org,trim(r.source_payload->>'name'),trim(r.source_payload->>'code')) on conflict(organization_id,code) do update set name=excluded.name;
  end if;
  v_applied:=v_applied+1;
 end loop;
 update public.master_data_import_batches set status='applied',accepted_count=v_applied,applied_at=now(),applied_by=(select auth.uid()),updated_at=now() where id=b.id;
 perform public.write_audit_event(v_org,'master_data_import.apply','master_data_import_batch',b.id::text,null,jsonb_build_object('input_type',b.input_type,'rows_applied',v_applied));
 return jsonb_build_object('batch_id',b.id,'status','applied','rows_applied',v_applied);
end;$fn$;
revoke all on function public.create_master_data_import_batch(uuid,text,text,jsonb),public.get_master_data_import_batch(uuid),public.apply_master_data_import_batch(uuid) from public,anon;
grant execute on function public.create_master_data_import_batch(uuid,text,text,jsonb),public.get_master_data_import_batch(uuid),public.apply_master_data_import_batch(uuid) to authenticated;
insert into public.organization_permissions(permission_key,name,description,category,permission_type,screen_key,route_path,sort_order) values('screen.master_data_import.view','استيراد البيانات الأساسية','شاشة استيراد الكيانات والأبعاد والبيانات المرجعية','data','screen','screen.master_data_import.view','/workspace/data/master-data',65) on conflict(permission_key) do update set screen_key=excluded.screen_key,route_path=excluded.route_path;
insert into public.organization_role_permissions(organization_id,role_key,permission_key) select om.organization_id,om.role_key,'screen.master_data_import.view' from public.organization_members om join public.organization_roles r on r.organization_id=om.organization_id and r.role_key=om.role_key where r.hierarchy_level>=90 on conflict do nothing;