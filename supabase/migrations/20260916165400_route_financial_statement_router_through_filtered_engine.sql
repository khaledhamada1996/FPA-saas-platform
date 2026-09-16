-- The filtered financial-statements engine is the canonical reporting path.
-- It preserves the current equity roll-forward and five-statement validation logic
-- for both period-aligned and arbitrary date ranges, while avoiding ambiguous
-- legacy exact-RPC overload resolution.

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
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then raise exception 'Invalid date range'; end if;
  if p_cash_flow_method not in ('direct','indirect') then raise exception 'Invalid cash flow method'; end if;
  if not (
    public.has_org_permission(p_organization_id,'screen.financial_statements.view')
    or public.has_org_permission(p_organization_id,'statements.view')
    or public.has_org_permission(p_organization_id,'view')
  ) then raise exception 'Financial statements view permission required'; end if;

  select public.get_financial_statements_date_range_filtered(
    p_organization_id,
    p_start_date,
    p_end_date,
    null,
    p_cash_flow_method,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  ) into r;

  return r;
end;
$$;
