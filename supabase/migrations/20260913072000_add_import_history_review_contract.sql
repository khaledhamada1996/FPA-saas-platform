-- Import history/review contract.
-- Keeps the current journal import execution path unchanged while exposing a secure history read model.

create or replace function public.get_import_history(p_organization_id uuid, p_input_type text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_user uuid := (select auth.uid()); v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_organization_id is null then raise exception 'Organization is required'; end if;
  if not public.has_org_permission(p_organization_id,'screen.data.view') or not public.has_org_permission(p_organization_id,'import.view') then raise exception 'Import view permission required'; end if;
  if p_input_type is not null and p_input_type not in ('actual_journal_transactions','trial_balance','chart_of_accounts','master_data','planning_data') then raise exception 'Unsupported input type'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'input_type',i.input_type,'file_name',i.file_name,'status',i.status,
    'row_count',i.row_count,'imported_row_count',i.imported_row_count,
    'error_count',i.error_count,'warning_count',i.warning_count,
    'mapping_version',i.mapping_version,'created_by',i.created_by,'created_at',i.created_at,
    'published_at',i.published_at,'published_by',i.published_by,
    'reconciliation_status',r.status,'difference_minor',r.difference_minor
  ) order by i.created_at desc),'[]'::jsonb)
  into v_result
  from public.imports i
  left join lateral (select status,difference_minor from public.import_reconciliations rr where rr.import_id=i.id order by rr.updated_at desc limit 1) r on true
  where i.organization_id=p_organization_id and (p_input_type is null or i.input_type=p_input_type);
  return v_result;
end;
$function$;

revoke all on function public.get_import_history(uuid,text) from public, anon;
grant execute on function public.get_import_history(uuid,text) to authenticated;

create index if not exists import_rows_import_id_row_number_idx on public.import_rows(import_id,row_number);
create index if not exists import_audit_events_import_id_created_idx on public.import_audit_events(import_id,created_at desc);
create index if not exists import_reconciliations_import_id_updated_idx on public.import_reconciliations(import_id,updated_at desc);
