-- Keep the exact-date engine for true arbitrary day ranges, but route period-aligned
-- ranges through the already-validated period aggregation engine. This avoids
-- unnecessary full-history scans for normal month/quarter/year reporting.
create index if not exists idx_financial_facts_report_date_actual_published
  on public.financial_facts (organization_id, transaction_date, account_id)
  where fact_type='actual' and status='published';

create index if not exists idx_financial_facts_report_journal_date
  on public.financial_facts (organization_id, journal_no, transaction_date, account_id)
  where fact_type='actual' and status='published' and journal_no is not null;

create index if not exists idx_financial_facts_source_lookup
  on public.financial_facts (source_import_id, source_row_key)
  where source_import_id is not null;

create or replace function public.get_financial_statements_report_router(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_cash_flow_method text default 'indirect'
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  r jsonb;
  v_period_aligned boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then raise exception 'Invalid date range'; end if;
  if p_cash_flow_method not in ('direct','indirect') then raise exception 'Invalid cash flow method'; end if;
  if not (
    public.has_org_permission(p_organization_id,'screen.financial_statements.view')
    or public.has_org_permission(p_organization_id,'statements.view')
    or public.has_org_permission(p_organization_id,'view')
  ) then raise exception 'Financial statements view permission required'; end if;

  select exists(
    select 1 from public.financial_periods p
    where p.organization_id=p_organization_id
      and p.period_start=p_start_date
      and p.period_end=p_end_date
  ) into v_period_aligned;

  if v_period_aligned then
    select public.get_financial_statements_date_range(
      p_organization_id,p_start_date,p_end_date,
      null,null,null,null,null,null,null,p_cash_flow_method
    ) into r;
  else
    select public.get_financial_statements_date_range_exact(
      p_organization_id,p_start_date,p_end_date,null,p_cash_flow_method
    ) into r;
  end if;
  return r;
end;
$function$;

revoke all on function public.get_financial_statements_report_router(uuid,date,date,text) from public;
grant execute on function public.get_financial_statements_report_router(uuid,date,date,text) to authenticated;

-- Preserve the existing exact engine and expose a safe router under the original
-- exact signature so existing callers remain compatible.
do $$
begin
  alter function public.get_financial_statements_date_range_exact(uuid,date,date,text,text)
    rename to get_financial_statements_date_range_exact_raw;
exception when undefined_function then null;
end $$;

create or replace function public.get_financial_statements_date_range_exact(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_journal_no text default null,
  p_cash_flow_method text default 'indirect'
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  r jsonb;
  v_period_aligned boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then raise exception 'Invalid date range'; end if;
  if p_cash_flow_method not in ('direct','indirect') then raise exception 'Invalid cash flow method'; end if;

  if p_journal_no is not null then
    select public.get_financial_statements_date_range_exact_raw(
      p_organization_id,p_start_date,p_end_date,p_journal_no,p_cash_flow_method
    ) into r;
  else
    select exists(
      select 1 from public.financial_periods p
      where p.organization_id=p_organization_id
        and p.period_start=p_start_date
        and p.period_end=p_end_date
    ) into v_period_aligned;
    if v_period_aligned then
      select public.get_financial_statements_date_range(
        p_organization_id,p_start_date,p_end_date,
        null,null,null,null,null,null,null,p_cash_flow_method
      ) into r;
    else
      select public.get_financial_statements_date_range_exact_raw(
        p_organization_id,p_start_date,p_end_date,null,p_cash_flow_method
      ) into r;
    end if;
  end if;
  return r;
end;
$function$;

revoke all on function public.get_financial_statements_date_range_exact(uuid,date,date,text,text) from public;
grant execute on function public.get_financial_statements_date_range_exact(uuid,date,date,text,text) to authenticated;
