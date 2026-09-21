create or replace function public.reconcile_integration(p_data_source_id uuid,p_sync_run_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_org uuid; v_source bigint; v_normalized bigint; v_rejected bigint; v_net bigint:=0; v_diff bigint:=0; v_bad_buckets bigint:=0; v_status text; v_reason text; v_id uuid;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select organization_id into v_org from public.data_sources where id=p_data_source_id; if v_org is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
 if not public.has_org_permission(v_org,'import.reconcile') and not public.has_org_permission(v_org,'admin') then raise exception 'Reconciliation permission required'; end if;
 select count(*) into v_source from public.sync_payloads where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id;
 select count(*) into v_normalized from public.integration_normalized_records where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id;
 select count(*) into v_rejected from public.integration_normalized_records where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id and normalization_status='rejected';
 if exists(select 1 from public.integration_normalized_records where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id and (normalization_status<>'normalized' or mapping_status<>'mapped' or (jsonb_typeof(dimensions)='object' and dimensions<>'{}'::jsonb and dimension_mapping_status<>'mapped'))) or v_source<>v_normalized then
   v_status:='blocked'; v_reason:=case when v_source<>v_normalized then format('Raw source count (%s) does not match normalized count (%s).',v_source,v_normalized) else 'One or more records are incomplete or unmapped.' end;
 else
   select coalesce(sum(abs(net)),0),count(*) filter(where net<>0),coalesce(sum(net),0) into v_diff,v_bad_buckets,v_net from (select coalesce(nullif(currency,''),'__NO_CURRENCY__') currency,sum(debit_minor-credit_minor) net from public.integration_normalized_records where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id group by 1) b;
   if v_bad_buckets>0 then v_status:='failed'; v_reason:=format('Unbalanced currency buckets: %s.',v_bad_buckets); else v_status:='passed'; v_reason:=null; end if;
 end if;
 insert into public.integration_reconciliations(organization_id,data_source_id,sync_run_id,source_record_count,normalized_record_count,rejected_record_count,source_debit_minor,source_credit_minor,normalized_net_minor,difference_minor,status,blocking_reason,created_by,updated_at)
 select v_org,p_data_source_id,p_sync_run_id,v_source,v_normalized,v_rejected,coalesce(sum(debit_minor),0),coalesce(sum(credit_minor),0),v_net,v_diff,v_status,v_reason,v_uid,now() from public.integration_normalized_records where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id
 on conflict(sync_run_id) do update set source_record_count=excluded.source_record_count,normalized_record_count=excluded.normalized_record_count,rejected_record_count=excluded.rejected_record_count,source_debit_minor=excluded.source_debit_minor,source_credit_minor=excluded.source_credit_minor,normalized_net_minor=excluded.normalized_net_minor,difference_minor=excluded.difference_minor,status=excluded.status,blocking_reason=excluded.blocking_reason,updated_at=now();
 select id into v_id from public.integration_reconciliations where sync_run_id=p_sync_run_id; return v_id;
end; $$;
revoke all on function public.reconcile_integration(uuid,uuid) from public,anon;
grant execute on function public.reconcile_integration(uuid,uuid) to authenticated;