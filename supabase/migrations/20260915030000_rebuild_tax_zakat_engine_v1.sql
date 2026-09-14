alter table public.organization_tax_profiles
  add column if not exists entity_type text,
  add column if not exists zakat_method text not null default 'indirect',
  add column if not exists fiscal_calendar text not null default 'gregorian',
  add column if not exists rule_version text not null default 'zatca_2025',
  add column if not exists tax_registration_status text not null default 'unknown';

alter table public.organization_tax_profiles drop constraint if exists organization_tax_profiles_regime_check;
alter table public.organization_tax_profiles add constraint organization_tax_profiles_regime_check check (regime in ('zakat','income_tax','mixed','none'));
alter table public.organization_tax_profiles drop constraint if exists organization_tax_profiles_zakat_method_check;
alter table public.organization_tax_profiles add constraint organization_tax_profiles_zakat_method_check check (zakat_method in ('direct','indirect'));
alter table public.organization_tax_profiles drop constraint if exists organization_tax_profiles_fiscal_calendar_check;
alter table public.organization_tax_profiles add constraint organization_tax_profiles_fiscal_calendar_check check (fiscal_calendar in ('gregorian','hijri'));

create table if not exists public.tax_zakat_account_mappings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  zakat_treatment text not null default 'needs_review',
  income_tax_treatment text not null default 'needs_review',
  notes text,
  approved boolean not null default false,
  approved_by uuid,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id,account_id),
  constraint tzam_zakat_treatment_check check (zakat_treatment in ('zakatable_asset','non_zakatable_asset','zakatable_investment','deductible_liability','internal_source','external_financing','other','not_applicable','needs_review')),
  constraint tzam_income_tax_treatment_check check (income_tax_treatment in ('taxable_income','exempt_income','deductible_expense','non_deductible_expense','tax_depreciation','book_depreciation','provision','other','not_applicable','needs_review'))
);

create table if not exists public.tax_zakat_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.financial_periods(id) on delete cascade,
  adjustment_type text not null,
  amount_minor bigint not null,
  description text not null,
  source_account_id uuid references public.accounts(id) on delete set null,
  approved boolean not null default false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tza_adjustment_type_check check (adjustment_type in ('income_tax_addition','income_tax_deduction','zakat_profit_addition','zakat_profit_deduction','zakat_external_financing','zakat_other_addition','zakat_other_deduction','tax_loss_carryforward'))
);

create table if not exists public.tax_zakat_rule_versions (
  rule_code text primary key,
  title text not null,
  effective_from date not null,
  effective_to date,
  source_name text not null,
  source_url text,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.tax_zakat_rule_versions(rule_code,title,effective_from,effective_to,source_name,source_url,notes) values
('ZATCA_ZAKAT_BASE_2025','ZATCA Zakat base calculation framework','2025-01-01',null,'ZATCA','https://zatca.gov.sa/en/HelpCenter/guidelines/Documents/Zakat%20General%20Guideline.pdf','Direct and indirect methods; account-level treatment and reconciliation required.'),
('IAS12_CURRENT_TAX','IAS 12 current tax framework','2026-01-01',null,'IFRS Foundation','https://www.ifrs.org/issued-standards/list-of-standards/ias-12-income-taxes/','Accounting tax expense is distinct from taxable profit used for tax calculation.')
on conflict(rule_code) do update set title=excluded.title,effective_from=excluded.effective_from,effective_to=excluded.effective_to,source_name=excluded.source_name,source_url=excluded.source_url,notes=excluded.notes,updated_at=now();

alter table public.tax_zakat_account_mappings enable row level security;
alter table public.tax_zakat_adjustments enable row level security;
alter table public.tax_zakat_rule_versions enable row level security;

drop policy if exists tax_zakat_account_mappings_select on public.tax_zakat_account_mappings;
create policy tax_zakat_account_mappings_select on public.tax_zakat_account_mappings for select to authenticated using (public.has_org_permission(organization_id,'screen.financial_statements.view') or public.has_org_permission(organization_id,'view'));
drop policy if exists tax_zakat_account_mappings_write on public.tax_zakat_account_mappings;
create policy tax_zakat_account_mappings_write on public.tax_zakat_account_mappings for all to authenticated using (public.has_org_permission(organization_id,'admin') or public.has_org_permission(organization_id,'settings.manage')) with check (public.has_org_permission(organization_id,'admin') or public.has_org_permission(organization_id,'settings.manage'));
drop policy if exists tax_zakat_adjustments_select on public.tax_zakat_adjustments;
create policy tax_zakat_adjustments_select on public.tax_zakat_adjustments for select to authenticated using (public.has_org_permission(organization_id,'screen.financial_statements.view') or public.has_org_permission(organization_id,'view'));
drop policy if exists tax_zakat_adjustments_write on public.tax_zakat_adjustments;
create policy tax_zakat_adjustments_write on public.tax_zakat_adjustments for all to authenticated using (public.has_org_permission(organization_id,'admin') or public.has_org_permission(organization_id,'settings.manage')) with check (public.has_org_permission(organization_id,'admin') or public.has_org_permission(organization_id,'settings.manage'));
drop policy if exists tax_zakat_rule_versions_select on public.tax_zakat_rule_versions;
create policy tax_zakat_rule_versions_select on public.tax_zakat_rule_versions for select to authenticated using (true);

create index if not exists idx_tzam_org_account on public.tax_zakat_account_mappings(organization_id,account_id);
create index if not exists idx_tza_org_period on public.tax_zakat_adjustments(organization_id,period_id);
grant select on public.tax_zakat_rule_versions to authenticated;
grant select,insert,update,delete on public.tax_zakat_account_mappings to authenticated;
grant select,insert,update,delete on public.tax_zakat_adjustments to authenticated;
revoke all on public.tax_zakat_rule_versions from anon;
revoke all on public.tax_zakat_account_mappings from anon;
revoke all on public.tax_zakat_adjustments from anon;
