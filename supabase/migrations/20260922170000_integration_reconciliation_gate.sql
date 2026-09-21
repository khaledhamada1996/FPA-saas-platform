create table if not exists public.integration_reconciliations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 data_source_id uuid not null references public.data_sources(id) on delete cascade, sync_run_id uuid not null references public.data_sync_runs(id) on delete cascade,
 source_record_count bigint not null default 0, normalized_record_count bigint not null default 0, rejected_record_count bigint not null default 0,
 source_debit_minor bigint not null default 0, source_credit_minor bigint not null default 0, normalized_net_minor bigint not null default 0, difference_minor bigint not null default 0,
 status text not null default 'failed', blocking_reason text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint integration_reconciliations_status_check check(status in ('passed','failed','blocked')), unique(sync_run_id)
);
create index if not exists idx_integration_reconciliations_source_status on public.integration_reconciliations(data_source_id,status);
alter table public.integration_reconciliations enable row level security;
drop policy if exists integration_reconciliations_select on public.integration_reconciliations;
create policy integration_reconciliations_select on public.integration_reconciliations for select to authenticated using(public.has_org_permission(organization_id,'mapping.view') or public.has_org_permission(organization_id,'view') or public.has_org_permission(organization_id,'admin'));

create or replace function public.reconcile_integration(p_data_source_id uuid,p_sync_run_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_org uuid; v_total bigint; v_normalized bigint; v_rejected bigint; v_debit bigint; v_credit bigint; v_net bigint; v_blocked bigint; v_id uuid; v_status text; v_reason text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select organization_id into v_org from public.data_sources where id=p_data_source_id;
 if v_org is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
 if not public.has_org_permission(v_org,'import.reconcile') and not public.has_org_permission(v_org,'admin') then raise exception 'Integration reconcile permission required'; end if;
 select count(*),count(*) filter(where normalization_status='normalized'),count(*) filter(where normalization_status='rejected'),coalesce(round(sum(coalesce(debit_minor,0))),0)::bigint,coalesce(round(sum(coalesce(credit_minor,0))),0)::bigint into v_total,v_normalized,v_rejected,v_debit,v_credit from public.integration_normalized_records where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id;
 if v_total=0 then raise exception 'No normalized records found'; end if;
 select count(*) into v_blocked from public.integration_normalized_records where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id and (normalization_status<>'normalized' or mapping_status<>'mapped' or (jsonb_typeof(dimensions)='object' and dimensions<>'{}'::jsonb and dimension_mapping_status<>'mapped'));
 v_net:=v_debit-v_credit;
 if v_blocked>0 then v_status:='blocked'; v_reason:=format('%s records are not fully normalized/mapped.',v_blocked); elsif v_net<>0 then v_status:='failed'; v_reason:='Normalized debit and credit totals do not balance.'; else v_status:='passed'; v_reason:=null; end if;
 insert into public.integration_reconciliations(organization_id,data_source_id,sync_run_id,source_record_count,normalized_record_count,rejected_record_count,source_debit_minor,source_credit_minor,normalized_net_minor,difference_minor,status,blocking_reason,created_by,updated_at) values(v_org,p_data_source_id,p_sync_run_id,v_total,v_normalized,v_rejected,v_debit,v_credit,v_net,v_net,v_status,v_reason,v_user,now()) on conflict(sync_run_id) do update set source_record_count=excluded.source_record_count,normalized_record_count=excluded.normalized_record_count,rejected_record_count=excluded.rejected_record_count,source_debit_minor=excluded.source_debit_minor,source_credit_minor=excluded.source_credit_minor,normalized_net_minor=excluded.normalized_net_minor,difference_minor=excluded.difference_minor,status=excluded.status,blocking_reason=excluded.blocking_reason,created_by=excluded.created_by,updated_at=now() returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.reconcile_integration(uuid,uuid) from public; grant execute on function public.reconcile_integration(uuid,uuid) to authenticated;

create or replace function public.validate_integration_publishability(p_data_source_id uuid,p_sync_run_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_org uuid; v_total bigint; v_blocked bigint; v_recon text; v_ready boolean;
begin
 select organization_id into v_org from public.data_sources where id=p_data_source_id;
 if v_org is null then raise exception 'DATA_SOURCE_NOT_FOUND'; end if;
 if not public.has_org_permission(v_org,'actuals.publish') and not public.has_org_permission(v_org,'admin') then raise exception 'Publish permission required'; end if;
 select count(*) into v_total from public.integration_normalized_records where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id;
 select count(*) into v_blocked from public.integration_normalized_records where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id and (normalization_status<>'normalized' or mapping_status<>'mapped' or (jsonb_typeof(dimensions)='object' and dimensions<>'{}'::jsonb and dimension_mapping_status<>'mapped'));
 select status into v_recon from public.integration_reconciliations where data_source_id=p_data_source_id and sync_run_id=p_sync_run_id;
 v_ready:=v_total>0 and v_blocked=0 and v_recon='passed';
 return jsonb_build_object('data_source_id',p_data_source_id,'sync_run_id',p_sync_run_id,'total',v_total,'blocked',v_blocked,'reconciliation_status',coalesce(v_recon,'not_run'),'publishable',v_ready);
end; $$;
revoke all on function public.validate_integration_publishability(uuid,uuid) from public; grant execute on function public.validate_integration_publishability(uuid,uuid) to authenticated;