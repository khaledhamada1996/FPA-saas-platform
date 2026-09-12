-- Import lifecycle hardening: mapping -> review -> reconciliation -> publish.
-- Publish remains atomic because the function runs in one transaction; any failure rolls back facts, batch, and import status.

alter table public.imports add column if not exists mapping_version text;
alter table public.imports add column if not exists published_by uuid references auth.users(id);
alter table public.actuals_publish_batches add column if not exists published_by uuid references auth.users(id);

alter table public.imports drop constraint if exists imports_status_check;
alter table public.imports add constraint imports_status_check check (status in ('uploaded','validating','mapping_required','ready_for_review','importing','imported','published','failed','rolled_back'));

create table if not exists public.import_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_id uuid not null unique references public.imports(id) on delete cascade,
  mapping_version text not null,
  source_row_count integer not null default 0 check (source_row_count >= 0),
  accepted_row_count integer not null default 0 check (accepted_row_count >= 0),
  rejected_row_count integer not null default 0 check (rejected_row_count >= 0),
  source_debit_minor bigint not null default 0,
  source_credit_minor bigint not null default 0,
  normalized_net_minor bigint not null default 0,
  difference_minor bigint not null default 0,
  status text not null default 'passed' check (status in ('passed','overridden','blocked')),
  override_reason text,
  overridden_by uuid references auth.users(id),
  overridden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists import_reconciliations_org_idx on public.import_reconciliations(organization_id);

create table if not exists public.import_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_id uuid not null references public.imports(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists import_audit_events_import_idx on public.import_audit_events(import_id, created_at desc);

alter table public.import_reconciliations enable row level security;
alter table public.import_audit_events enable row level security;
revoke all on table public.import_reconciliations from anon, authenticated;
revoke all on table public.import_audit_events from anon, authenticated;

-- The existing ingest RPC performs file/row validation before inserting normalized rows.
-- Its resulting state is now mapping_required rather than authoritative validated.
create or replace function public.ingest_validated_import(p_organization_id uuid,p_file_name text,p_file_hash text,p_rows jsonb)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  v_user uuid := (select auth.uid()); v_import_id uuid; v_existing_id uuid; v_row_count integer; v_bad_count integer; v_unbalanced_count integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_organization_id is null then raise exception 'Organization is required'; end if;
  if not public.has_org_permission(p_organization_id,'import') then raise exception 'Import permission required for this organization'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Rows must be a JSON array'; end if;
  v_row_count := jsonb_array_length(p_rows);
  if v_row_count=0 then raise exception 'Import contains no rows'; end if;
  if v_row_count>50000 then raise exception 'Import exceeds the 50000 row limit'; end if;
  if nullif(trim(p_file_name),'') is null then raise exception 'File name is required'; end if;
  if p_file_hash is not null then
    select id into v_existing_id from public.imports where organization_id=p_organization_id and file_hash=p_file_hash order by created_at desc limit 1;
    if v_existing_id is not null then return v_existing_id; end if;
  end if;
  with parsed as (
    select elem,nullif(trim(elem->>'date'),'') date_text,nullif(trim(elem->>'journal_no'),'') journal_no,nullif(trim(elem->>'account_code'),'') account_code,nullif(trim(elem->>'account_name'),'') account_name,
      case when coalesce(elem->>'debit','') ~ '^([0-9]+(\\.[0-9]+)?)$' then (elem->>'debit')::numeric else null end debit,
      case when coalesce(elem->>'credit','') ~ '^([0-9]+(\\.[0-9]+)?)$' then (elem->>'credit')::numeric else null end credit
    from jsonb_array_elements(p_rows) elem
  ) select count(*) into v_bad_count from parsed where date_text is null or date_text !~ '^\\d{4}-\\d{2}-\\d{2}$' or journal_no is null or account_code is null or account_name is null or debit is null or credit is null or debit<0 or credit<0 or (debit>0 and credit>0) or (debit=0 and credit=0);
  if v_bad_count>0 then raise exception 'Import contains invalid rows: %',v_bad_count; end if;
  with parsed as (select elem->>'journal_no' journal_no,(elem->>'debit')::numeric debit,(elem->>'credit')::numeric credit from jsonb_array_elements(p_rows) elem),unbalanced as (select journal_no from parsed group by journal_no having abs(sum(debit)-sum(credit))>0.005) select count(*) into v_unbalanced_count from unbalanced;
  if v_unbalanced_count>0 then raise exception 'Import contains % unbalanced journal entries',v_unbalanced_count; end if;
  insert into public.imports(organization_id,file_name,file_hash,status,row_count,imported_row_count,error_count,warning_count,created_by)
  values(p_organization_id,trim(p_file_name),p_file_hash,'mapping_required',v_row_count,0,0,0,v_user) returning id into v_import_id;
  insert into public.import_rows(import_id,organization_id,row_number,source_key,payload,validation_status,validation_message)
  select v_import_id,p_organization_id,ordinality::integer,coalesce(nullif(elem->>'source_key',''),coalesce(p_file_hash,'no-hash')||':'||ordinality::text),elem-'source_key','valid',null
  from jsonb_array_elements(p_rows) with ordinality;
  insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata)
  values(p_organization_id,v_import_id,v_user,'ingest',null,'mapping_required',jsonb_build_object('row_count',v_row_count,'file_name',trim(p_file_name)));
  return v_import_id;
end;
$function$;

create or replace function public.prepare_import_for_review(p_import_id uuid,p_mapping_version text)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare v_user uuid := (select auth.uid()); v_org uuid; v_status text; v_missing integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_mapping_version is null or btrim(p_mapping_version)='' then raise exception 'Mapping version is required'; end if;
  select organization_id,status into v_org,v_status from public.imports where id=p_import_id for update;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org,'import') then raise exception 'Import permission required'; end if;
  if v_status not in ('mapping_required','validated','ready_for_review') then raise exception 'Import cannot be prepared from status %',v_status; end if;
  select count(*) into v_missing from public.import_rows r left join public.account_mappings m on m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.source_code=(r.payload->>'account_code') and m.status='approved' where r.import_id=p_import_id and m.id is null;
  if v_missing>0 then raise exception 'Import requires % approved account mappings',v_missing; end if;
  update public.imports set mapping_version=btrim(p_mapping_version),status='ready_for_review' where id=p_import_id;
  insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata)
  values(v_org,p_import_id,v_user,'prepare_for_review',v_status,'ready_for_review',jsonb_build_object('mapping_version',btrim(p_mapping_version)));
  return p_import_id;
end;
$function$;

create or replace function public.reconcile_import(p_import_id uuid)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare v_user uuid := (select auth.uid()); v_org uuid; v_status text; v_mapping text; v_rows integer; v_bad integer; v_debit bigint; v_credit bigint; v_net bigint; v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select organization_id,status,mapping_version into v_org,v_status,v_mapping from public.imports where id=p_import_id for update;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org,'import') then raise exception 'Import permission required'; end if;
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
  insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata)
  values(v_org,p_import_id,v_user,'reconcile',v_status,v_status,jsonb_build_object('reconciliation_id',v_id,'difference_minor',0,'mapping_version',btrim(v_mapping)));
  return v_id;
end;
$function$;

create or replace function public.publish_actuals_from_import(p_import_id uuid,p_mapping_version text)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare v_user uuid := (select auth.uid()); v_org uuid; v_status text; v_import_mapping text; v_batch uuid; v_rows integer; v_bad integer; v_mapping_count integer; v_recon_status text; r record; v_date date; v_period uuid; v_account uuid; v_debit bigint; v_credit bigint; v_amount bigint; v_currency text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_mapping_version is null or btrim(p_mapping_version)='' then raise exception 'Mapping version is required'; end if;
  select organization_id,status,mapping_version into v_org,v_status,v_import_mapping from public.imports where id=p_import_id for update;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org,'import') then raise exception 'Not authorized'; end if;
  if v_status<>'ready_for_review' then raise exception 'Import is not ready for publishing'; end if;
  if v_import_mapping is null or btrim(v_import_mapping)<>btrim(p_mapping_version) then raise exception 'Selected mapping version is not bound to this import'; end if;
  select status into v_recon_status from public.import_reconciliations where import_id=p_import_id and organization_id=v_org;
  if v_recon_status not in ('passed','overridden') then raise exception 'Reconciliation must pass before publishing'; end if;
  select count(*) into v_rows from public.import_rows where import_id=p_import_id and validation_status='valid';
  select count(*) into v_bad from public.import_rows where import_id=p_import_id and validation_status in ('pending','warning','error');
  if v_rows=0 or v_bad>0 then raise exception 'Import contains rows that are not valid'; end if;
  if exists(select 1 from public.actuals_publish_batches where import_id=p_import_id and status='published') then
    select id into v_batch from public.actuals_publish_batches where import_id=p_import_id and status='published' order by created_at desc limit 1; return v_batch;
  end if;
  select count(*) into v_mapping_count from public.account_mappings m where m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.status='approved';
  if v_mapping_count=0 then raise exception 'Mapping version is not approved'; end if;
  if exists(select 1 from public.import_rows r left join public.account_mappings m on m.organization_id=v_org and m.mapping_version=btrim(p_mapping_version) and m.source_code=(r.payload->>'account_code') and m.status='approved' where r.import_id=p_import_id and m.id is null) then raise exception 'Every account must have an approved mapping in the selected mapping version'; end if;
  update public.imports set status='importing' where id=p_import_id;
  select o.base_currency into v_currency from public.organizations o where o.id=v_org;
  for r in select * from public.import_rows where import_id=p_import_id and validation_status='valid' order by row_number loop
    v_date:=(r.payload->>'date')::date;
    select id into v_period from public.financial_periods where organization_id=v_org and period_start<=v_date and period_end>=v_date order by period_start desc limit 1;
    if v_period is null then insert into public.financial_periods(organization_id,period_start,period_end,status) values(v_org,date_trunc('month',v_date)::date,(date_trunc('month',v_date)+interval '1 month - 1 day')::date,'open') returning id into v_period; end if;
    select target_account_id into v_account from public.account_mappings where organization_id=v_org and mapping_version=btrim(p_mapping_version) and source_code=(r.payload->>'account_code') and status='approved';
    if v_account is null then raise exception 'Every account must have an approved mapping in the selected mapping version'; end if;
    v_debit:=round(coalesce(nullif(r.payload->>'debit','')::numeric,0)*100)::bigint; v_credit:=round(coalesce(nullif(r.payload->>'credit','')::numeric,0)*100)::bigint; v_amount:=v_debit-v_credit;
    insert into public.financial_facts(organization_id,financial_period_id,account_id,currency,amount_minor,fact_type,source_import_id,source_row_key,journal_no,description,debit_minor,credit_minor) values(v_org,v_period,v_account,v_currency,v_amount,'actual',p_import_id,r.source_key,r.payload->>'journal_no',r.payload->>'description',v_debit,v_credit);
  end loop;
  insert into public.actuals_publish_batches(organization_id,import_id,mapping_version,status,row_count,published_at,published_by) values(v_org,p_import_id,btrim(p_mapping_version),'published',v_rows,now(),v_user) returning id into v_batch;
  update public.imports set status='published',imported_row_count=v_rows,published_at=now(),published_by=v_user where id=p_import_id;
  insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata) values(v_org,p_import_id,v_user,'publish','ready_for_review','published',jsonb_build_object('batch_id',v_batch,'mapping_version',btrim(p_mapping_version),'row_count',v_rows));
  return v_batch;
end;
$function$;

revoke execute on function public.prepare_import_for_review(uuid,text) from public,anon;
grant execute on function public.prepare_import_for_review(uuid,text) to authenticated;
revoke execute on function public.reconcile_import(uuid) from public,anon;
grant execute on function public.reconcile_import(uuid) to authenticated;
revoke execute on function public.ingest_validated_import(uuid,text,text,jsonb) from public,anon;
grant execute on function public.ingest_validated_import(uuid,text,text,jsonb) to authenticated;
revoke execute on function public.publish_actuals_from_import(uuid,text) from public,anon;
grant execute on function public.publish_actuals_from_import(uuid,text) to authenticated;
