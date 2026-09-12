-- Avoid per-row auth.uid() evaluation inside helper functions used by RLS.
create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.organization_members
    where organization_id=target_organization_id
      and user_id=(select auth.uid())
      and (select auth.uid()) is not null
  );
$$;

create or replace function public.is_org_admin(target_organization_id uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.organization_members
    where organization_id=target_organization_id
      and user_id=(select auth.uid())
      and (select auth.uid()) is not null
      and coalesce(role_key,case role when 'admin' then 'company_admin' when 'owner' then 'company_admin' else 'viewer' end)='company_admin'
  );
$$;

-- Remove redundant public SELECT policies. Authenticated member policies remain the controlled read boundary.
drop policy if exists "tenant members can read accounts" on public.accounts;
drop policy if exists "tenant members can read branches" on public.branches;
drop policy if exists "tenant members can read cost centers" on public.cost_centers;
drop policy if exists "tenant members can read departments" on public.departments;
drop policy if exists "tenant members can read financial periods" on public.financial_periods;
drop policy if exists "tenant members can read legal entities" on public.legal_entities;
drop policy if exists "tenant members can read products" on public.products;
drop policy if exists "tenant members can read projects" on public.projects;
drop policy if exists "tenant members can read regions" on public.regions;

-- Management policies do not need SELECT because the dedicated member SELECT policies already cover administrators.
drop policy if exists "admins can manage account categories" on public.account_categories;
create policy "admins can manage account categories" on public.account_categories for insert to authenticated with check (is_org_admin(organization_id));
create policy "admins can update account categories" on public.account_categories for update to authenticated using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy "admins can delete account categories" on public.account_categories for delete to authenticated using (is_org_admin(organization_id));

drop policy if exists "admins can manage accounts" on public.accounts;
create policy "admins can insert accounts" on public.accounts for insert to authenticated with check (is_org_admin(organization_id));
create policy "admins can update accounts" on public.accounts for update to authenticated using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy "admins can delete accounts" on public.accounts for delete to authenticated using (is_org_admin(organization_id));

drop policy if exists "admins can manage branches" on public.branches;
create policy "admins can insert branches" on public.branches for insert to authenticated with check (is_org_admin(organization_id));
create policy "admins can update branches" on public.branches for update to authenticated using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy "admins can delete branches" on public.branches for delete to authenticated using (is_org_admin(organization_id));

drop policy if exists "admins can manage cost centers" on public.cost_centers;
create policy "admins can insert cost centers" on public.cost_centers for insert to authenticated with check (is_org_admin(organization_id));
create policy "admins can update cost centers" on public.cost_centers for update to authenticated using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy "admins can delete cost centers" on public.cost_centers for delete to authenticated using (is_org_admin(organization_id));

drop policy if exists "admins can manage departments" on public.departments;
create policy "admins can insert departments" on public.departments for insert to authenticated with check (is_org_admin(organization_id));
create policy "admins can update departments" on public.departments for update to authenticated using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy "admins can delete departments" on public.departments for delete to authenticated using (is_org_admin(organization_id));

drop policy if exists "admins can manage financial periods" on public.financial_periods;
create policy "admins can insert financial periods" on public.financial_periods for insert to authenticated with check (is_org_admin(organization_id));
create policy "admins can update financial periods" on public.financial_periods for update to authenticated using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy "admins can delete financial periods" on public.financial_periods for delete to authenticated using (is_org_admin(organization_id));

drop policy if exists "admins can manage legal entities" on public.legal_entities;
create policy "admins can insert legal entities" on public.legal_entities for insert to authenticated with check (is_org_admin(organization_id));
create policy "admins can update legal entities" on public.legal_entities for update to authenticated using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy "admins can delete legal entities" on public.legal_entities for delete to authenticated using (is_org_admin(organization_id));

drop policy if exists "admins can manage products" on public.products;
create policy "admins can insert products" on public.products for insert to authenticated with check (is_org_admin(organization_id));
create policy "admins can update products" on public.products for update to authenticated using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy "admins can delete products" on public.products for delete to authenticated using (is_org_admin(organization_id));

drop policy if exists "admins can manage projects" on public.projects;
create policy "admins can insert projects" on public.projects for insert to authenticated with check (is_org_admin(organization_id));
create policy "admins can update projects" on public.projects for update to authenticated using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy "admins can delete projects" on public.projects for delete to authenticated using (is_org_admin(organization_id));

drop policy if exists "admins can manage regions" on public.regions;
create policy "admins can insert regions" on public.regions for insert to authenticated with check (is_org_admin(organization_id));
create policy "admins can update regions" on public.regions for update to authenticated using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy "admins can delete regions" on public.regions for delete to authenticated using (is_org_admin(organization_id));

-- Replace redundant ALL policies on planning tables with mutation-only policies.
drop policy if exists cash_forecast_manage on public.cash_forecast_lines;
create policy cash_forecast_insert on public.cash_forecast_lines for insert to authenticated with check (has_org_permission(organization_id,'manage_budget'));
create policy cash_forecast_update on public.cash_forecast_lines for update to authenticated using (has_org_permission(organization_id,'manage_budget')) with check (has_org_permission(organization_id,'manage_budget'));
create policy cash_forecast_delete on public.cash_forecast_lines for delete to authenticated using (has_org_permission(organization_id,'manage_budget'));

drop policy if exists scenarios_manage on public.planning_scenarios;
create policy scenarios_insert on public.planning_scenarios for insert to authenticated with check (has_org_permission(organization_id,'manage_budget'));
create policy scenarios_update on public.planning_scenarios for update to authenticated using (has_org_permission(organization_id,'manage_budget')) with check (has_org_permission(organization_id,'manage_budget'));
create policy scenarios_delete on public.planning_scenarios for delete to authenticated using (has_org_permission(organization_id,'manage_budget'));

drop policy if exists scenario_adjustments_manage on public.scenario_adjustments;
create policy scenario_adjustments_insert on public.scenario_adjustments for insert to authenticated with check (exists (select 1 from public.planning_scenarios s where s.id=scenario_adjustments.scenario_id and has_org_permission(s.organization_id,'manage_budget') and s.status='draft'));
create policy scenario_adjustments_update on public.scenario_adjustments for update to authenticated using (exists (select 1 from public.planning_scenarios s where s.id=scenario_adjustments.scenario_id and has_org_permission(s.organization_id,'manage_budget') and s.status='draft')) with check (exists (select 1 from public.planning_scenarios s where s.id=scenario_adjustments.scenario_id and has_org_permission(s.organization_id,'manage_budget') and s.status='draft'));
create policy scenario_adjustments_delete on public.scenario_adjustments for delete to authenticated using (exists (select 1 from public.planning_scenarios s where s.id=scenario_adjustments.scenario_id and has_org_permission(s.organization_id,'manage_budget') and s.status='draft'));

-- Optimize the remaining direct auth.uid() check in forecast insertion.
drop policy if exists forecast_lines_insert on public.forecast_lines;
create policy forecast_lines_insert on public.forecast_lines for insert to authenticated with check (has_org_permission(organization_id,'manage_budget') and created_by=(select auth.uid()));
