create or replace function public.get_integration_review_summary(p_data_source_id uuid,p_sync_run_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_total bigint; v_normalized bigint; v_account_mapped bigint; v_account_review bigint; v_dim_mapped bigint; v_dim_review bigint; v_rejected bigint; v_ready bigint;
begin
 select organization_id into v_org from public.data_sources where id=p_data_source_id;
 if v_org is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
 if not public.has_org_permission(v_org,'mapping.view') and not public.has_org_permission(v_org,'view') and not public.has_org_permission(v_org,'admin') then raise exception 'Permission denied'; end if;
 select count(*) into v_total from public.integration_normalized_records r where r.data_source_id=p_data_source_id and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id);
 select count(*) into v_normalized from public.integration_normalized_records r where r.data_source_id=p_data_source_id and r.normalization_status='normalized' and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id);
 select count(*) into v_account_mapped from public.integration_normalized_records r where r.data_source_id=p_data_source_id and r.mapping_status='mapped' and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id);
 select count(*) into v_account_review from public.integration_normalized_records r where r.data_source_id=p_data_source_id and r.mapping_status='needs_review' and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id);
 select count(*) into v_dim_mapped from public.integration_normalized_records r where r.data_source_id=p_data_source_id and r.dimension_mapping_status='mapped' and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id);
 select count(*) into v_dim_review from public.integration_normalized_records r where r.data_source_id=p_data_source_id and r.dimension_mapping_status='needs_review' and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id);
 select count(*) into v_rejected from public.integration_normalized_records r where r.data_source_id=p_data_source_id and (r.normalization_status='rejected' or r.mapping_status='rejected' or r.dimension_mapping_status='rejected') and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id);
 select count(*) into v_ready from public.integration_normalized_records r where r.data_source_id=p_data_source_id and r.normalization_status='normalized' and r.mapping_status='mapped' and r.dimension_mapping_status in ('mapped','unmapped') and (p_sync_run_id is null or r.sync_run_id=p_sync_run_id);
 return jsonb_build_object('data_source_id',p_data_source_id,'sync_run_id',p_sync_run_id,'total',v_total,'normalized',v_normalized,'account_mapped',v_account_mapped,'account_needs_review',v_account_review,'dimension_mapped',v_dim_mapped,'dimension_needs_review',v_dim_review,'rejected',v_rejected,'ready_for_reconciliation',v_ready);
end; $$;
revoke all on function public.get_integration_review_summary(uuid,uuid) from public; grant execute on function public.get_integration_review_summary(uuid,uuid) to authenticated;

create or replace function public.validate_integration_publishability(p_data_source_id uuid,p_sync_run_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_total bigint; v_blocked bigint; v_ready boolean;
begin
 select organization_id into v_org from public.data_sources where id=p_data_source_id;
 if v_org is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
 if not public.has_org_permission(v_org,'actuals.publish') and not public.has_org_permission(v_org,'admin') then raise exception 'Publish permission required'; end if;
 select count(*) into v_total from public.integration_normalized_records r where r.data_source_id=p_data_source_id and r.sync_run_id=p_sync_run_id;
 select count(*) into v_blocked from public.integration_normalized_records r where r.data_source_id=p_data_source_id and r.sync_run_id=p_sync_run_id and (r.normalization_status<>'normalized' or r.mapping_status<>'mapped' or r.dimension_mapping_status not in ('mapped','unmapped'));
 v_ready := v_total > 0 and v_blocked=0;
 return jsonb_build_object('data_source_id',p_data_source_id,'sync_run_id',p_sync_run_id,'total',v_total,'blocked',v_blocked,'publishable',v_ready);
end; $$;
revoke all on function public.validate_integration_publishability(uuid,uuid) from public; grant execute on function public.validate_integration_publishability(uuid,uuid) to authenticated;