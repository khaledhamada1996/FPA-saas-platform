create or replace function public.get_integration_publish_preview(p_data_source_id uuid,p_sync_run_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_org uuid; v_total bigint; v_debit numeric; v_credit numeric; v_min date; v_max date; v_currencies jsonb;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select organization_id into v_org from public.data_sources where id=p_data_source_id;
 if v_org is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
 if not public.has_org_permission(v_org,'actuals.view') and not public.has_org_permission(v_org,'view') and not public.has_org_permission(v_org,'admin') then raise exception 'View permission required'; end if;
 if not exists(select 1 from public.data_sync_runs where id=p_sync_run_id and data_source_id=p_data_source_id) then raise exception 'SYNC_RUN_NOT_FOUND'; end if;
 select count(*)::bigint,coalesce(sum(debit_minor),0),coalesce(sum(credit_minor),0),min(transaction_date),max(transaction_date),coalesce(jsonb_agg(x.currency order by x.currency),'[]'::jsonb)
 into v_total,v_debit,v_credit,v_min,v_max,v_currencies
 from public.integration_normalized_records r
 left join lateral (select coalesce(nullif(r.currency,''),'SAR')::text as currency) x on true
 where r.data_source_id=p_data_source_id and r.sync_run_id=p_sync_run_id and r.normalization_status='normalized' and r.mapping_status='mapped' and (jsonb_typeof(r.dimensions)<>'object' or r.dimensions='{}'::jsonb or r.dimension_mapping_status='mapped');
 return jsonb_build_object('data_source_id',p_data_source_id,'sync_run_id',p_sync_run_id,'row_count',v_total,'debit_minor',v_debit,'credit_minor',v_credit,'net_minor',v_debit-v_credit,'date_from',v_min,'date_to',v_max,'currencies',v_currencies);
end; $$;
revoke all on function public.get_integration_publish_preview(uuid,uuid) from public,anon;
grant execute on function public.get_integration_publish_preview(uuid,uuid) to authenticated;

create or replace function public.publish_integration_actuals(p_data_source_id uuid,p_sync_run_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_org uuid; v_legal uuid; v_batch uuid; v_total int; v_existing int; v_closed int;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select organization_id,legal_entity_id into v_org,v_legal from public.data_sources where id=p_data_source_id;
 if v_org is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
 if not public.has_org_permission(v_org,'actuals.publish') and not public.has_org_permission(v_org,'admin') then raise exception 'Actuals publish permission required'; end if;
 if not exists(select 1 from public.data_sync_runs where id=p_sync_run_id and data_source_id=p_data_source_id) then raise exception 'SYNC_RUN_NOT_FOUND'; end if;
 if not exists(select 1 from public.integration_reconciliations where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id and status='passed') then raise exception 'Integration reconciliation must be passed before publish'; end if;
 select count(*)::int into v_total from public.integration_normalized_records r where r.data_source_id=p_data_source_id and r.sync_run_id=p_sync_run_id and r.normalization_status='normalized' and r.mapping_status='mapped' and (jsonb_typeof(r.dimensions)<>'object' or r.dimensions='{}'::jsonb or r.dimension_mapping_status='mapped');
 if v_total=0 then raise exception 'No publishable normalized records'; end if;
 if exists(select 1 from public.integration_normalized_records r where r.data_source_id=p_data_source_id and r.sync_run_id=p_sync_run_id and (r.normalization_status<>'normalized' or r.mapping_status<>'mapped' or (jsonb_typeof(r.dimensions)='object' and r.dimensions<>'{}'::jsonb and r.dimension_mapping_status<>'mapped'))) then raise exception 'Integration contains incomplete records'; end if;
 select count(*)::int into v_existing from public.financial_facts where organization_id=v_org and source_batch_id=p_sync_run_id;
 if v_existing>0 then select id into v_batch from public.integration_publish_batches where sync_run_id=p_sync_run_id; return v_batch; end if;
 insert into public.financial_periods(organization_id,period_start,period_end,status)
 select v_org,m.period_start,(m.period_start+interval '1 month - 1 day')::date,'open' from (select distinct date_trunc('month',transaction_date)::date period_start from public.integration_normalized_records where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id) m on conflict(organization_id,period_start) do nothing;
 select count(*)::int into v_closed from public.financial_periods fp where fp.organization_id=v_org and fp.period_start in (select distinct date_trunc('month',transaction_date)::date from public.integration_normalized_records where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id) and fp.status<>'open';
 if v_closed>0 then raise exception 'One or more financial periods are closed'; end if;
 insert into public.financial_facts(organization_id,financial_period_id,account_id,legal_entity_id,branch_id,department_id,cost_center_id,region_id,product_id,project_id,currency,amount_minor,fact_type,source_import_id,source_row_key,journal_no,description,debit_minor,credit_minor,version_no,source_batch_id,status,transaction_date,record_hash)
 select r.organization_id,fp.id,r.mapped_account_id,coalesce((r.mapped_dimensions->'legal_entity'->>'target_id')::uuid,v_legal),(r.mapped_dimensions->'branch'->>'target_id')::uuid,(r.mapped_dimensions->'department'->>'target_id')::uuid,(r.mapped_dimensions->'cost_center'->>'target_id')::uuid,(r.mapped_dimensions->'region'->>'target_id')::uuid,(r.mapped_dimensions->'product'->>'target_id')::uuid,(r.mapped_dimensions->'project'->>'target_id')::uuid,coalesce(nullif(r.currency,''),'SAR')::char(3),r.debit_minor-r.credit_minor,'actual',null,r.source_record_key,r.journal_no,r.description,r.debit_minor,r.credit_minor,1,p_sync_run_id,'published',r.transaction_date,encode(extensions.digest(convert_to(coalesce(r.source_payload,'{}'::jsonb)::text,'UTF8'),'sha256'),'hex')
 from public.integration_normalized_records r join public.financial_periods fp on fp.organization_id=v_org and fp.period_start=date_trunc('month',r.transaction_date)::date where r.data_source_id=p_data_source_id and r.sync_run_id=p_sync_run_id;
 insert into public.integration_publish_batches(organization_id,data_source_id,sync_run_id,row_count,status,published_by,published_at) values(v_org,p_data_source_id,p_sync_run_id,v_total,'published',v_uid,now()) returning id into v_batch;
 return v_batch;
end; $$;
revoke all on function public.publish_integration_actuals(uuid,uuid) from public,anon;
grant execute on function public.publish_integration_actuals(uuid,uuid) to authenticated;
