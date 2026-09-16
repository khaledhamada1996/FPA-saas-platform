create or replace function public.create_monthly_financial_periods(target_organization_id uuid, fiscal_year integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  start_month smallint;
  fy_start date;
  inserted_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_org_permission(target_organization_id,'manage_settings') then raise exception 'Not authorized'; end if;
  if fiscal_year < 2000 or fiscal_year > 2100 then raise exception 'Fiscal year out of supported range'; end if;

  select fiscal_year_start_month into start_month
  from public.organizations
  where id = target_organization_id;
  if start_month is null then raise exception 'organization not found'; end if;

  fy_start := make_date(fiscal_year, start_month, 1);

  insert into public.financial_periods(
    organization_id, period_start, period_end, status, fiscal_year, period_number
  )
  select
    target_organization_id,
    (fy_start + make_interval(months => gs))::date,
    (fy_start + make_interval(months => gs + 1) - interval '1 day')::date,
    'open',
    fiscal_year,
    (gs + 1)::smallint
  from generate_series(0,11) gs
  on conflict (organization_id, period_start, period_end) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
