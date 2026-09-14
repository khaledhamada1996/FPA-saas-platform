create table if not exists public.organization_tax_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  regime text not null default 'zakat' check (regime in ('zakat','income_tax','mixed','none')),
  saudi_ownership_percent numeric(7,4) not null default 100 check (saudi_ownership_percent between 0 and 100),
  income_tax_rate numeric(7,4) not null default 20 check (income_tax_rate between 0 and 100),
  zakat_rate numeric(7,4) not null default 2.5 check (zakat_rate between 0 and 100),
  calculation_basis text not null default 'preliminary_indirect' check (calculation_basis in ('preliminary_indirect','manual_adjusted_base')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_tax_profiles enable row level security;

create policy "organization_tax_profiles_select" on public.organization_tax_profiles
for select to authenticated
using (public.has_org_permission(organization_id,'screen.financial_statements.view') or public.has_org_permission(organization_id,'view'));

create policy "organization_tax_profiles_insert" on public.organization_tax_profiles
for insert to authenticated
with check (public.has_org_permission(organization_id,'admin') or public.has_org_permission(organization_id,'settings.manage'));

create policy "organization_tax_profiles_update" on public.organization_tax_profiles
for update to authenticated
using (public.has_org_permission(organization_id,'admin') or public.has_org_permission(organization_id,'settings.manage'))
with check (public.has_org_permission(organization_id,'admin') or public.has_org_permission(organization_id,'settings.manage'));

create or replace function public.calculate_tax_zakat(
  p_organization_id uuid,
  p_period_id uuid,
  p_branch_id uuid default null,
  p_department_id uuid default null,
  p_cost_center_id uuid default null,
  p_region_id uuid default null,
  p_product_id uuid default null,
  p_project_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  profile record;
  fs jsonb;
  bs jsonb;
  ebt bigint := 0;
  net_income bigint := 0;
  assets bigint := 0;
  liabilities bigint := 0;
  equity bigint := 0;
  adjusted_profit bigint := 0;
  preliminary_zakat_base bigint := 0;
  preliminary_zakat bigint := 0;
  taxable_profit bigint := 0;
  income_tax bigint := 0;
  saudi_share bigint := 0;
  non_saudi_share bigint := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (public.has_org_permission(p_organization_id,'screen.financial_statements.view') or public.has_org_permission(p_organization_id,'statements.view') or public.has_org_permission(p_organization_id,'view')) then
    raise exception 'Financial statements view permission required';
  end if;

  select * into profile from public.organization_tax_profiles where organization_id = p_organization_id;
  if not found then
    profile.regime := 'zakat';
    profile.saudi_ownership_percent := 100;
    profile.income_tax_rate := 20;
    profile.zakat_rate := 2.5;
    profile.calculation_basis := 'preliminary_indirect';
  end if;

  fs := public.get_financial_statements(
    p_organization_id,p_period_id,p_branch_id,p_department_id,p_cost_center_id,
    p_region_id,p_product_id,p_project_id,null,'indirect'
  );

  ebt := coalesce((fs->'income_statement_ytd'->>'ebt')::bigint,0);
  net_income := coalesce((fs->'income_statement_ytd'->>'net_income')::bigint,0);
  assets := coalesce((fs->'balance_sheet'->>'total_assets')::bigint,0);
  liabilities := coalesce((fs->'balance_sheet'->>'total_liabilities')::bigint,0);
  equity := coalesce((fs->'balance_sheet'->>'displayed_equity')::bigint,(fs->'balance_sheet'->>'total_equity')::bigint,0);

  adjusted_profit := greatest(ebt,0);
  preliminary_zakat_base := greatest(greatest(equity + adjusted_profit,0),greatest(assets-liabilities,0));
  preliminary_zakat := round(preliminary_zakat_base * coalesce(profile.zakat_rate,2.5) / 100.0)::bigint;

  taxable_profit := greatest(ebt,0);
  income_tax := round(taxable_profit * coalesce(profile.income_tax_rate,20) / 100.0 * (100 - coalesce(profile.saudi_ownership_percent,100)) / 100.0)::bigint;
  saudi_share := round(taxable_profit * coalesce(profile.saudi_ownership_percent,100) / 100.0)::bigint;
  non_saudi_share := greatest(taxable_profit-saudi_share,0);

  return jsonb_build_object(
    'regime',coalesce(profile.regime,'zakat'),
    'period_id',p_period_id,
    'net_income_ytd',net_income,
    'profit_before_tax_ytd',ebt,
    'assets',assets,
    'liabilities',liabilities,
    'equity',equity,
    'adjusted_profit_assumption',adjusted_profit,
    'preliminary_zakat_base',preliminary_zakat_base,
    'preliminary_zakat',case when coalesce(profile.regime,'zakat') in ('zakat','mixed') then preliminary_zakat else 0 end,
    'taxable_profit_assumption',taxable_profit,
    'saudi_taxable_share',saudi_share,
    'non_saudi_taxable_share',non_saudi_share,
    'preliminary_income_tax',case when coalesce(profile.regime,'zakat') in ('income_tax','mixed') then income_tax else 0 end,
    'total_preliminary_charge',
      (case when coalesce(profile.regime,'zakat') in ('zakat','mixed') then preliminary_zakat else 0 end) +
      (case when coalesce(profile.regime,'zakat') in ('income_tax','mixed') then income_tax else 0 end),
    'warning','هذه نتيجة تقديرية أولية وليست إقرارًا زكويًا أو ضريبيًا. يلزم اعتماد المعالجات الزكوية والضريبية والتعديلات النظامية قبل التقديم.'
  );
end;
$function$;

revoke all on function public.calculate_tax_zakat(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.calculate_tax_zakat(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;

revoke all on table public.organization_tax_profiles from anon;
grant select, insert, update on public.organization_tax_profiles to authenticated;
