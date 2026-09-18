-- Secure direct creation of manually entered journal entries.
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
  if not public.has_org_permission(p_organization_id,'actuals.publish') then raise exception 'Journal entry permission required'; end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'Lines must be a JSON array'; end if;
  v_row_count := jsonb_array_length(p_lines);
  if v_row_count < 2 then raise exception 'Journal entry requires at least two lines'; end if;
  if v_row_count > 500 then raise exception 'Journal entry exceeds the line limit'; end if;

  select o.id,o.base_currency into v_org,v_currency from public.organizations o where o.id=p_organization_id;
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

  if exists (select 1 from public.financial_facts ff where ff.organization_id=p_organization_id and ff.journal_no=v_journal_no and ff.fact_type='actual' and ff.status='published' and ff.superseded_by is null) then
    raise exception 'Journal number already exists; use the journal amendment screen to edit it';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_lines) x(elem)
    left join public.accounts a on a.id=nullif(btrim(x.elem->>'account_id'),'')::uuid and a.organization_id=p_organization_id
    where a.id is null
  ) then raise exception 'Every journal line must reference an account from the active organization'; end if;

  if exists (
    select 1 from (select distinct date_trunc('month',(elem->>'date')::date)::date period_start from jsonb_array_elements(p_lines) x(elem)) d
    join public.financial_periods fp on fp.organization_id=p_organization_id and fp.period_start=d.period_start and fp.status in ('locked','closed','finalized')
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
  values(p_organization_id,'manual-journal-'||v_journal_no,encode(sha256(convert_to(p_lines::text,'UTF8')),'hex'),'actual_journal_transactions','published',v_row_count,v_row_count,0,0,v_user,now(),'manual',v_user)
  returning id into v_import_id;

  insert into public.financial_periods(organization_id,period_start,period_end,status)
  select p_organization_id,d.period_start,(d.period_start+interval '1 month - 1 day')::date,'open'
  from (select distinct date_trunc('month',(elem->>'date')::date)::date period_start from jsonb_array_elements(p_lines) x(elem)) d
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
    'actual',v_import_id,v_import_id::text||':'||((x.elem->>'line_no')::integer),v_journal_no,x.elem->>'description',
    round(coalesce(nullif(x.elem->>'debit','')::numeric,0)*100)::bigint,round(coalesce(nullif(x.elem->>'credit','')::numeric,0)*100)::bigint,
    (x.elem->>'date')::date,'published',1,null,null,v_batch_id
  from jsonb_array_elements(p_lines) x(elem)
  join public.financial_periods fp on fp.organization_id=p_organization_id and fp.period_start=date_trunc('month',(x.elem->>'date')::date)::date;

  insert into public.import_audit_events(organization_id,import_id,actor_id,action,from_status,to_status,metadata)
  values(p_organization_id,v_import_id,v_user,'manual_create',null,'published',jsonb_build_object('journal_no',v_journal_no,'row_count',v_row_count,'source','manual_journal'));
  return v_batch_id;
end;
$function$;

revoke all on function public.create_manual_journal_entry(uuid,jsonb) from public,anon;
grant execute on function public.create_manual_journal_entry(uuid,jsonb) to authenticated;
