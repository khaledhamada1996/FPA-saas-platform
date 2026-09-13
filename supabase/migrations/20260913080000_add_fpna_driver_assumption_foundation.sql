create table if not exists public.planning_drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_key text not null,
  name text not null,
  description text,
  value_type text not null default 'numeric' check (value_type in ('numeric','text','boolean')),
  unit text,
  currency char(3),
  frequency text not null default 'monthly' check (frequency in ('daily','weekly','monthly','quarterly','annual','event')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, driver_key)
);

create table if not exists public.planning_driver_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_id uuid not null references public.planning_drivers(id) on delete cascade,
  planning_version_id uuid references public.planning_versions(id) on delete cascade,
  financial_period_id uuid references public.financial_periods(id) on delete restrict,
  scenario_id uuid references public.planning_scenarios(id) on delete cascade,
  legal_entity_id uuid,
  branch_id uuid,
  department_id uuid,
  cost_center_id uuid,
  region_id uuid,
  product_id uuid,
  project_id uuid,
  value_numeric numeric,
  value_text text,
  value_boolean boolean,
  currency char(3),
  source_type text not null default 'manual' check (source_type in ('manual','import','integration','calculated')),
  source_import_id uuid references public.imports(id) on delete set null,
  source_reference text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (((value_numeric is not null)::int + (value_text is not null)::int + (value_boolean is not null)::int) = 1)
);

create index if not exists planning_drivers_org_active_idx on public.planning_drivers(organization_id, is_active);
create index if not exists planning_driver_values_org_period_idx on public.planning_driver_values(organization_id, financial_period_id);
create index if not exists planning_driver_values_version_idx on public.planning_driver_values(planning_version_id);
create index if not exists planning_driver_values_driver_period_idx on public.planning_driver_values(driver_id, financial_period_id);
create index if not exists planning_driver_values_source_import_idx on public.planning_driver_values(source_import_id);

alter table public.planning_drivers enable row level security;
alter table public.planning_driver_values enable row level security;

revoke all on public.planning_drivers from anon, authenticated;
revoke all on public.planning_driver_values from anon, authenticated;

create or replace function public.get_fpna_data_contract()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'master_data', jsonb_build_array('organization','legal_entities','branches','departments','cost_centers','regions','products','projects'),
    'financial_foundation', jsonb_build_array('accounts','financial_periods'),
    'actuals', jsonb_build_array('actual_journal_transactions','trial_balance'),
    'planning', jsonb_build_array('budget','forecast','drivers_assumptions','scenarios','cash_plan'),
    'governance', jsonb_build_array('mapping','validation','reconciliation','publish','rollback','audit'),
    'analytics', jsonb_build_array('trial_balance','financial_statements','financial_analysis','variance','cash_forecast','executive_dashboard','ai_financial_analyst')
  );
$$;

revoke all on function public.get_fpna_data_contract() from public, anon;
grant execute on function public.get_fpna_data_contract() to authenticated;

comment on table public.planning_drivers is 'FP&A driver definitions used to build driver-based budgets and forecasts.';
comment on table public.planning_driver_values is 'Versioned, periodized driver/assumption values with optional dimensions and source traceability.';
