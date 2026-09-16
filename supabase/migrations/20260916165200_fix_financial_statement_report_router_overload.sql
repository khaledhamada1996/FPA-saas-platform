-- Disambiguate the exact date-range statement RPC overload used by the report router.
-- The explicit 12-argument call prevents PostgreSQL from resolving the legacy
-- 5-argument overload ambiguously.

create or replace function public.get_financial_statements_report_router(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_cash_flow_method text default 'indirect'
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
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
    select 1
    from public.financial_periods p
    where p.organization_id=p_organization_id
      and p.period_start=p_start_date
      and p.period_end=p_end_date
  ) into v_period_aligned;

  if v_period_aligned then
    select public.get_financial_statements_date_range(
      p_organization_id,p_start_date,p_end_date,null,null,null,null,null,null,null,p_cash_flow_method
    ) into r;
  else
    select public.get_financial_statements_date_range_exact(
      p_organization_id,
      p_start_date,
      p_end_date,
      null::text,
      p_cash_flow_method,
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid
    ) into r;
  end if;

  return r;
end;
$$;
