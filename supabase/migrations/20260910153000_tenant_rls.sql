-- Tenant isolation and authorization hardening.
-- Every tenant-owned table is protected by organization membership and, where applicable,
-- action-based permissions. This migration is intentionally separate from the core schema
-- so security policy changes remain auditable and independently deployable.

alter table roles
  alter column organization_id set not null;

alter table roles
  add constraint roles_org_id_unique unique (organization_id, id);

alter table organization_users
  drop constraint if exists organization_users_role_id_fkey;

alter table organization_users
  add constraint organization_users_role_same_org_fk
  foreign key (organization_id, role_id)
  references roles (organization_id, id)
  on delete set null;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_users ou
    where ou.organization_id = target_org
      and ou.user_id = auth.uid()
      and ou.status = 'active'
  );
$$;

create or replace function public.has_org_permission(target_org uuid, target_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_users ou
    join public.role_permissions rp on rp.role_id = ou.role_id
    join public.permissions p on p.id = rp.permission_id
    where ou.organization_id = target_org
      and ou.user_id = auth.uid()
      and ou.status = 'active'
      and p.action = target_action
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_permission(uuid, text) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_permission(uuid, text) to authenticated;

-- RLS is enabled on every table containing tenant-owned data.
alter table organizations enable row level security;
alter table roles enable row level security;
alter table role_permissions enable row level security;
alter table organization_users enable row level security;
alter table legal_entities enable row level security;
alter table branches enable row level security;
alter table departments enable row level security;
alter table cost_centers enable row level security;
alter table regions enable row level security;
alter table products enable row level security;
alter table projects enable row level security;
alter table account_categories enable row level security;
alter table accounts enable row level security;
alter table financial_periods enable row level security;
alter table planning_versions enable row level security;
alter table financial_facts enable row level security;
alter table data_sources enable row level security;
alter table imports enable row level security;
alter table mapping_rules enable row level security;

-- Organizations: membership controls visibility; workspace permission controls mutation.
create policy organizations_select_member on organizations
  for select to authenticated
  using (public.is_org_member(id));

create policy organizations_update_manage on organizations
  for update to authenticated
  using (public.has_org_permission(id, 'workspace.manage'))
  with check (public.has_org_permission(id, 'workspace.manage'));

create policy organizations_delete_manage on organizations
  for delete to authenticated
  using (public.has_org_permission(id, 'workspace.manage'));

-- Memberships: users can always see their own membership; managers can administer the tenant.
create policy organization_users_select on organization_users
  for select to authenticated
  using (user_id = auth.uid() or public.has_org_permission(organization_id, 'users.manage'));

create policy organization_users_insert_manage on organization_users
  for insert to authenticated
  with check (public.has_org_permission(organization_id, 'users.manage'));

create policy organization_users_update_manage on organization_users
  for update to authenticated
  using (public.has_org_permission(organization_id, 'users.manage'))
  with check (public.has_org_permission(organization_id, 'users.manage'));

create policy organization_users_delete_manage on organization_users
  for delete to authenticated
  using (public.has_org_permission(organization_id, 'users.manage'));

-- Roles and role assignments are tenant administration data.
create policy roles_select_member on roles
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy roles_insert_manage on roles
  for insert to authenticated
  with check (public.has_org_permission(organization_id, 'workspace.manage'));

create policy roles_update_manage on roles
  for update to authenticated
  using (public.has_org_permission(organization_id, 'workspace.manage'))
  with check (public.has_org_permission(organization_id, 'workspace.manage'));

create policy roles_delete_manage on roles
  for delete to authenticated
  using (public.has_org_permission(organization_id, 'workspace.manage'));

create policy role_permissions_select_member on role_permissions
  for select to authenticated
  using (
    exists (
      select 1 from roles r
      where r.id = role_permissions.role_id
        and public.is_org_member(r.organization_id)
    )
  );

create policy role_permissions_manage on role_permissions
  for all to authenticated
  using (
    exists (
      select 1 from roles r
      where r.id = role_permissions.role_id
        and public.has_org_permission(r.organization_id, 'workspace.manage')
    )
  )
  with check (
    exists (
      select 1 from roles r
      where r.id = role_permissions.role_id
        and public.has_org_permission(r.organization_id, 'workspace.manage')
    )
  );

-- Reference/master data is visible to tenant members and mutable by workspace managers.
create policy legal_entities_member_select on legal_entities for select to authenticated using (public.is_org_member(organization_id));
create policy legal_entities_manage on legal_entities for all to authenticated using (public.has_org_permission(organization_id, 'workspace.manage')) with check (public.has_org_permission(organization_id, 'workspace.manage'));
create policy branches_member_select on branches for select to authenticated using (public.is_org_member(organization_id));
create policy branches_manage on branches for all to authenticated using (public.has_org_permission(organization_id, 'workspace.manage')) with check (public.has_org_permission(organization_id, 'workspace.manage'));
create policy departments_member_select on departments for select to authenticated using (public.is_org_member(organization_id));
create policy departments_manage on departments for all to authenticated using (public.has_org_permission(organization_id, 'workspace.manage')) with check (public.has_org_permission(organization_id, 'workspace.manage'));
create policy cost_centers_member_select on cost_centers for select to authenticated using (public.is_org_member(organization_id));
create policy cost_centers_manage on cost_centers for all to authenticated using (public.has_org_permission(organization_id, 'workspace.manage')) with check (public.has_org_permission(organization_id, 'workspace.manage'));
create policy regions_member_select on regions for select to authenticated using (public.is_org_member(organization_id));
create policy regions_manage on regions for all to authenticated using (public.has_org_permission(organization_id, 'workspace.manage')) with check (public.has_org_permission(organization_id, 'workspace.manage'));
create policy products_member_select on products for select to authenticated using (public.is_org_member(organization_id));
create policy products_manage on products for all to authenticated using (public.has_org_permission(organization_id, 'workspace.manage')) with check (public.has_org_permission(organization_id, 'workspace.manage'));
create policy projects_member_select on projects for select to authenticated using (public.is_org_member(organization_id));
create policy projects_manage on projects for all to authenticated using (public.has_org_permission(organization_id, 'workspace.manage')) with check (public.has_org_permission(organization_id, 'workspace.manage'));
create policy account_categories_member_select on account_categories for select to authenticated using (public.is_org_member(organization_id));
create policy account_categories_manage on account_categories for all to authenticated using (public.has_org_permission(organization_id, 'workspace.manage')) with check (public.has_org_permission(organization_id, 'workspace.manage'));
create policy accounts_member_select on accounts for select to authenticated using (public.is_org_member(organization_id));
create policy accounts_manage on accounts for all to authenticated using (public.has_org_permission(organization_id, 'workspace.manage')) with check (public.has_org_permission(organization_id, 'workspace.manage'));

-- Planning and analytical data use their corresponding action permissions.
create policy financial_periods_member_select on financial_periods for select to authenticated using (public.is_org_member(organization_id));
create policy financial_periods_manage on financial_periods for all to authenticated using (public.has_org_permission(organization_id, 'workspace.manage')) with check (public.has_org_permission(organization_id, 'workspace.manage'));

create policy planning_versions_member_select on planning_versions for select to authenticated using (public.is_org_member(organization_id));
create policy planning_versions_budget_manage on planning_versions for all to authenticated using (
  public.has_org_permission(organization_id, 'budget.edit') or
  public.has_org_permission(organization_id, 'budget.approve') or
  public.has_org_permission(organization_id, 'forecast.edit') or
  public.has_org_permission(organization_id, 'forecast.approve') or
  public.has_org_permission(organization_id, 'scenario.edit')
) with check (
  public.has_org_permission(organization_id, 'budget.edit') or
  public.has_org_permission(organization_id, 'budget.approve') or
  public.has_org_permission(organization_id, 'forecast.edit') or
  public.has_org_permission(organization_id, 'forecast.approve') or
  public.has_org_permission(organization_id, 'scenario.edit')
);

create policy financial_facts_member_select on financial_facts
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy financial_facts_publish on financial_facts
  for insert to authenticated
  with check (public.has_org_permission(organization_id, 'data.publish'));

create policy financial_facts_adjust on financial_facts
  for update to authenticated
  using (public.has_org_permission(organization_id, 'data.publish'))
  with check (public.has_org_permission(organization_id, 'data.publish'));

create policy financial_facts_delete_manage on financial_facts
  for delete to authenticated
  using (public.has_org_permission(organization_id, 'workspace.manage'));

create policy data_sources_member_select on data_sources for select to authenticated using (public.is_org_member(organization_id));
create policy data_sources_manage on data_sources for all to authenticated using (public.has_org_permission(organization_id, 'workspace.manage')) with check (public.has_org_permission(organization_id, 'workspace.manage'));

create policy imports_member_select on imports for select to authenticated using (public.is_org_member(organization_id));
create policy imports_insert on imports for insert to authenticated with check (public.has_org_permission(organization_id, 'data.import'));
create policy imports_update on imports for update to authenticated using (public.has_org_permission(organization_id, 'data.import')) with check (public.has_org_permission(organization_id, 'data.import'));
create policy imports_delete on imports for delete to authenticated using (public.has_org_permission(organization_id, 'workspace.manage'));

create policy mapping_rules_member_select on mapping_rules for select to authenticated using (public.is_org_member(organization_id));
create policy mapping_rules_manage on mapping_rules for all to authenticated using (public.has_org_permission(organization_id, 'data.map')) with check (public.has_org_permission(organization_id, 'data.map'));

-- The permissions table is a global catalog and is intentionally not tenant-scoped.
-- No RLS policy is added here because it contains no organization-owned data.

comment on function public.is_org_member(uuid) is 'Security-definer tenant membership check used by RLS policies; avoids recursive organization_users policy evaluation.';
comment on function public.has_org_permission(uuid, text) is 'Security-definer action authorization check used by RLS policies; resolves tenant membership through role permissions.';
