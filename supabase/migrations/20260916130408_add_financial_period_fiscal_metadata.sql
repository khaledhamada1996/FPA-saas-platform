alter table public.financial_periods
  add column if not exists fiscal_year integer,
  add column if not exists period_number smallint;

update public.financial_periods fp
set
  fiscal_year = extract(year from fp.period_start)::integer,
  period_number = extract(month from fp.period_start)::smallint
where fp.fiscal_year is null or fp.period_number is null;

alter table public.financial_periods
  alter column fiscal_year set not null,
  alter column period_number set not null;

alter table public.financial_periods
  add constraint financial_periods_period_number_check check (period_number between 1 and 12);

create unique index if not exists financial_periods_org_fiscal_year_period_number_uidx
  on public.financial_periods (organization_id, fiscal_year, period_number);
