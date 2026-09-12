-- Import dataset contract foundation.
-- The current executable import path remains actual journal transactions.
-- Other dataset types are represented explicitly but remain intentionally unsupported until their domain contracts are implemented.

alter table public.imports add column if not exists input_type text;

update public.imports
set input_type = 'actual_journal_transactions'
where input_type is null;

alter table public.imports alter column input_type set default 'actual_journal_transactions';
alter table public.imports alter column input_type set not null;

alter table public.imports drop constraint if exists imports_input_type_check;
alter table public.imports add constraint imports_input_type_check check (input_type = any (array[
  'actual_journal_transactions'::text,
  'trial_balance'::text,
  'chart_of_accounts'::text,
  'master_data'::text,
  'planning_data'::text
]));

create index if not exists imports_organization_input_type_created_idx
  on public.imports (organization_id, input_type, created_at desc);

create or replace function public.get_import_review(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_import jsonb;
  v_reconciliation jsonb;
  v_audit jsonb;
  v_sources jsonb;
  v_accounts jsonb;
  v_mappings jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_import_id is null then raise exception 'Import ID is required'; end if;
  select i.organization_id into v_org from public.imports i where i.id=p_import_id;
  if v_org is null then raise exception 'Import not found'; end if;
  if not public.has_org_permission(v_org,'screen.data.view') or not public.has_org_permission(v_org,'import.view') then raise exception 'Import view permission required'; end if;
  select jsonb_build_object(
    'id',i.id,'organization_id',i.organization_id,'input_type',i.input_type,
    'file_name',i.file_name,'file_hash',i.file_hash,'status',i.status,
    'row_count',i.row_count,'imported_row_count',i.imported_row_count,
    'error_count',i.error_count,'warning_count',i.warning_count,
    'mapping_version',i.mapping_version,'created_at',i.created_at,
    'published_at',i.published_at,'published_by',i.published_by
  ) into v_import from public.imports i where i.id=p_import_id;
  select coalesce((select jsonb_agg(to_jsonb(r) order by r.updated_at desc) from public.import_reconciliations r where r.import_id=p_import_id and r.organization_id=v_org),'[]'::jsonb) into v_reconciliation;
  select coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'from_status',e.from_status,'to_status',e.to_status,'actor_id',e.actor_id,'metadata',e.metadata,'created_at',e.created_at) order by e.created_at desc) from public.import_audit_events e where e.import_id=p_import_id and e.organization_id=v_org),'[]'::jsonb) into v_audit;
  select coalesce((select jsonb_agg(jsonb_build_object('source_code',s.source_code,'source_name',s.source_name,'row_count',s.row_count,'mapping_id',m.id,'mapping_status',m.status,'target_account_id',m.target_account_id,'target_account_code',a.code,'target_account_name',a.name) order by s.source_code) from (select r.payload->>'account_code' source_code,max(r.payload->>'account_name') source_name,count(*)::integer row_count from public.import_rows r where r.import_id=p_import_id group by r.payload->>'account_code' order by count(*) desc limit 500) s left join public.account_mappings m on m.organization_id=v_org and m.mapping_version=coalesce((v_import->>'mapping_version'),'v1') and m.source_code=s.source_code left join public.accounts a on a.id=m.target_account_id and a.organization_id=v_org),'[]'::jsonb) into v_sources;
  select coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'code',a.code,'name',a.name,'account_type',a.account_type,'statement_type',a.statement_type,'statement_section',a.statement_section) order by a.code) from public.accounts a where a.organization_id=v_org limit 1000),'[]'::jsonb) into v_accounts;
  select coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'mapping_version',m.mapping_version,'source_code',m.source_code,'source_name',m.source_name,'target_account_id',m.target_account_id,'status',m.status,'created_by',m.created_by,'approved_by',m.approved_by,'approved_at',m.approved_at) order by m.mapping_version,m.source_code) from public.account_mappings m where m.organization_id=v_org and (m.mapping_version=coalesce((v_import->>'mapping_version'),'v1') or m.status='draft') limit 1000),'[]'::jsonb) into v_mappings;
  return jsonb_build_object('import',v_import,'reconciliation',v_reconciliation,'audit_events',v_audit,'sources',v_sources,'accounts',v_accounts,'mappings',v_mappings);
end;
$function$;

revoke all on function public.get_import_review(uuid) from public, anon;
grant execute on function public.get_import_review(uuid) to authenticated;

create or replace function public.ingest_validated_import(p_organization_id uuid,p_file_name text,p_file_hash text,p_rows jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_import_id uuid;
  v_existing_id uuid;
  v_row_count integer;
  v_bad_count integer;
  v_unbalanced_count integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_organization_id is null then raise exception 'Organization is required'; end if;
  if not public.has_org_permission(p_organization_id,'import.create') then raise exception 'Import create permission required'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Rows must be a JSON array'; end if;
  v_row_count:=jsonb_array_length(p_rows);
  if v_row_count=0 then raise exception 'Import contains no rows'; end if;
  if v_row_count>50000 then raise exception 'Import exceeds the 50000 row limit'; end if;
  if nullif(trim(p_file_name),'') is null then raise exception 'File name is required'; end if;
  if p_file_hash is not null then
    select id into v_existing_id from public.imports where organization_id=p_organization_id and file_hash=p_file_hash order by created_at desc limit 1;
    if v_existing_id is not null then return v_existing_id; end if;
  end if;
  with parsed as (
    select elem,
      nullif(trim(elem->>'date'),'') date_text,
      nullif(trim(elem->>'journal_no'),'') journal_no,
      nullif(trim(elem->>'account_code'),'') account_code,
      nullif(trim(elem->>'account_name'),'') account_name,
      case when coalesce(elem->>'debit','') ~ '^([0-9]+(\\.[0-9]+)?)$' then (elem->>'debit')::numeric else null end debit,
      case when coalesce(elem->>'credit','') ~ '^([0-9]+(\\.[0-9]+)?)$' then (elem->>'credit')::numeric else null end credit
    from jsonb_array_elements(p_rows) elem
  )
  select count(*) into v_bad_count from parsed where date_text is null or date_text !~ '^\\d{4}-\\d{2}-\\d{2}$' or journal_no is null or account_code is null or account_name is null or debit is null or credit is null or debit<0 or credit<0 or (debit>0 and credit>0) or (debit=0 and credit=0);
  if v_bad_count>0 then raise exception 'Import contains invalid rows: %',v_bad_count; end if;
  with parsed as (select elem->>'journal_no' journal_no,(elem->>'debit')::numeric debit,(elem->>'credit')::numeric credit from jsonb_array_elements(p_rows) elem),unbalanced as (select journal_no from parsed group by journal_no having abs(sum(debit)-sum(credit))>0.005)
  select count(*) into v_unbalanced_count from unbalanced;
  if v_unbalanced_count>0 then raise exception 'Import contains % unbalanced journal entries',v_unbalanced_count; end if;
  insert into public.imports(organization_id,file_name,file_hash,input_type,status,row_count,imported_row_count,error_count,warning_count,created_by)
  values(p_organization_id,trim(p_file_name),p_file_hash,'actual_journal_transactions','mapping_required',v_row_count,0,0,0,v_user)
  returning id into v_import_id;
  insert into public.import_rows(import_id,organization_id,row_number,source_key,payload,validation_status,validation_message)
  select v_import_id,p_organization_id,ordinality::integer,coalesce(nullif(elem->>'source_key',''),coalesce(p_file_hash,'no-hash')||':'||ordinality::text),elem-'source_key','valid',null from jsonb_array_elements(p_rows) with ordinality;
  insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata)
  values(p_organization_id,v_import_id,v_user,'ingest',null,'mapping_required',jsonb_build_object('row_count',v_row_count,'file_name',trim(p_file_name),'input_type','actual_journal_transactions'));
  return v_import_id;
end;
$function$;

revoke all on function public.ingest_validated_import(uuid,text,text,jsonb) from public, anon;
grant execute on function public.ingest_validated_import(uuid,text,text,jsonb) to authenticated;
