-- Reconcile integration runs independently per currency.
-- Different currencies must never offset one another.

create or replace function public.reconcile_integration(p_data_source_id uuid, p_sync_run_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_org uuid;
  v_total bigint;
  v_normalized bigint;
  v_rejected bigint;
  v_debit bigint;
  v_credit bigint;
  v_net bigint;
  v_difference bigint:=0;
  v_blocked bigint;
  v_unbalanced_currencies bigint:=0;
  v_id uuid;
  v_status text;
  v_reason text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select organization_id into v_org from public.data_sources where id=p_data_source_id;
  if v_org is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
  if not public.has_org_permission(v_org,'import.reconcile') and not public.has_org_permission(v_org,'admin') then
    raise exception 'Integration reconcile permission required';
  end if;

  select count(*),
         count(*) filter(where normalization_status='normalized'),
         count(*) filter(where normalization_status='rejected'),
         coalesce(round(sum(coalesce(debit_minor,0))),0)::bigint,
         coalesce(round(sum(coalesce(credit_minor,0))),0)::bigint
  into v_total,v_normalized,v_rejected,v_debit,v_credit
  from public.integration_normalized_records
  where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id;

  if v_total=0 then raise exception 'No normalized records found'; end if;

  select count(*) into v_blocked
  from public.integration_normalized_records
  where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id
    and (
      normalization_status<>'normalized'
      or mapping_status<>'mapped'
      or (jsonb_typeof(dimensions)='object' and dimensions<>'{}'::jsonb and dimension_mapping_status<>'mapped')
    );

  select count(*), coalesce(sum(abs(net_minor)),0)::bigint
  into v_unbalanced_currencies, v_difference
  from (
    select coalesce(nullif(btrim(currency),''),'__NO_CURRENCY__') as currency_bucket,
           coalesce(round(sum(coalesce(debit_minor,0))),0)::bigint -
           coalesce(round(sum(coalesce(credit_minor,0))),0)::bigint as net_minor
    from public.integration_normalized_records
    where data_source_id=p_data_source_id
      and sync_run_id=p_sync_run_id
    group by 1
    having coalesce(round(sum(coalesce(debit_minor,0))),0)::bigint -
           coalesce(round(sum(coalesce(credit_minor,0))),0)::bigint <> 0
  ) x;

  v_net:=v_debit-v_credit;

  if v_blocked>0 then
    v_status:='blocked';
    v_reason:=format('%s records are not fully normalized/mapped.',v_blocked);
    v_difference:=0;
  elsif v_unbalanced_currencies>0 then
    v_status:='failed';
    v_reason:=format('%s currency bucket(s) do not balance independently.',v_unbalanced_currencies);
  else
    v_status:='passed';
    v_reason:=null;
    v_difference:=0;
  end if;

  insert into public.integration_reconciliations(
    organization_id,data_source_id,sync_run_id,source_record_count,
    normalized_record_count,rejected_record_count,source_debit_minor,
    source_credit_minor,normalized_net_minor,difference_minor,status,
    blocking_reason,created_by,updated_at
  )
  values(
    v_org,p_data_source_id,p_sync_run_id,v_total,v_normalized,v_rejected,
    v_debit,v_credit,v_net,v_difference,v_status,v_reason,v_user,now()
  )
  on conflict(sync_run_id) do update set
    source_record_count=excluded.source_record_count,
    normalized_record_count=excluded.normalized_record_count,
    rejected_record_count=excluded.rejected_record_count,
    source_debit_minor=excluded.source_debit_minor,
    source_credit_minor=excluded.source_credit_minor,
    normalized_net_minor=excluded.normalized_net_minor,
    difference_minor=excluded.difference_minor,
    status=excluded.status,
    blocking_reason=excluded.blocking_reason,
    created_by=excluded.created_by,
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$function$;
