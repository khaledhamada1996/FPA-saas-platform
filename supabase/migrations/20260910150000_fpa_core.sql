create extension if not exists pgcrypto;

create type organization_status as enum ('active','suspended');
create type membership_status as enum ('active','invited','suspended');
create type planning_version_status as enum ('draft','submitted','approved','locked');
create type financial_period_status as enum ('open','closed','locked');
create type fact_type as enum ('actual','adjustment','budget','forecast','scenario');
create type import_status as enum ('uploaded','validating','mapping','preview','importing','reconciled','published','failed');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency char(3) not null check (base_currency ~ '^[A-Z]{3}$'),
  status organization_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  action text not null unique,
  description text
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table organization_users (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null,
  role_id uuid references roles(id) on delete set null,
  status membership_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  foreign key (role_id) references roles(id) on delete set null
);

create table legal_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  code text not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  legal_entity_id uuid references legal_entities(id) on delete set null,
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table cost_centers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table regions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table account_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  statement_type text not null check (statement_type in ('income_statement','balance_sheet','cash_flow')),
  parent_id uuid references account_categories(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  name text not null,
  category_id uuid references account_categories(id) on delete set null,
  normal_balance text not null check (normal_balance in ('debit','credit')),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table financial_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status financial_period_status not null default 'open',
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (organization_id, period_start, period_end)
);

create table planning_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  version_type text not null check (version_type in ('budget','forecast','scenario')),
  name text not null,
  status planning_version_status not null default 'draft',
  based_on_version_id uuid references planning_versions(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  locked_at timestamptz,
  unique (organization_id, version_type, name)
);

create table financial_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  legal_entity_id uuid references legal_entities(id) on delete restrict,
  financial_period_id uuid not null references financial_periods(id) on delete restrict,
  account_id uuid not null references accounts(id) on delete restrict,
  branch_id uuid references branches(id) on delete restrict,
  department_id uuid references departments(id) on delete restrict,
  cost_center_id uuid references cost_centers(id) on delete restrict,
  region_id uuid references regions(id) on delete restrict,
  product_id uuid references products(id) on delete restrict,
  project_id uuid references projects(id) on delete restrict,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null,
  fact_type fact_type not null,
  planning_version_id uuid references planning_versions(id) on delete restrict,
  source_import_id uuid,
  source_row_key text,
  created_at timestamptz not null default now(),
  check ((fact_type in ('budget','forecast','scenario')) = (planning_version_id is not null)),
  check (fact_type not in ('budget','forecast','scenario') or planning_version_id is not null)
);

create table data_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  source_type text not null check (source_type in ('excel','csv','erp','accounting','crm','payroll','other')),
  created_at timestamptz not null default now()
);

create table imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  data_source_id uuid references data_sources(id) on delete set null,
  file_name text not null,
  file_hash text,
  status import_status not null default 'uploaded',
  row_count integer not null default 0 check (row_count >= 0),
  imported_row_count integer not null default 0 check (imported_row_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

alter table financial_facts
  add constraint financial_facts_source_import_fk
  foreign key (source_import_id) references imports(id) on delete set null;

create table mapping_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  source_pattern text not null,
  target_account_id uuid references accounts(id) on delete restrict,
  priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_org_users_user on organization_users(user_id);
create index idx_roles_org on roles(organization_id);
create index idx_entities_org on legal_entities(organization_id);
create index idx_branches_org on branches(organization_id);
create index idx_departments_org on departments(organization_id);
create index idx_cost_centers_org on cost_centers(organization_id);
create index idx_regions_org on regions(organization_id);
create index idx_products_org on products(organization_id);
create index idx_projects_org on projects(organization_id);
create index idx_accounts_org on accounts(organization_id);
create index idx_periods_org_status on financial_periods(organization_id, status);
create index idx_versions_org_type_status on planning_versions(organization_id, version_type, status);
create index idx_facts_org_period on financial_facts(organization_id, financial_period_id);
create index idx_facts_org_account on financial_facts(organization_id, account_id);
create index idx_facts_org_type_version on financial_facts(organization_id, fact_type, planning_version_id);
create index idx_imports_org_created on imports(organization_id, created_at desc);
create index idx_mapping_rules_org_priority on mapping_rules(organization_id, priority);

insert into permissions (action, description) values
('workspace.view','View workspace'),
('workspace.manage','Manage workspace'),
('data.import','Import data'),
('data.map','Create and manage mappings'),
('data.publish','Publish imported data'),
('budget.view','View budgets'),
('budget.edit','Edit budgets'),
('budget.submit','Submit budgets'),
('budget.approve','Approve budgets'),
('forecast.view','View forecasts'),
('forecast.edit','Edit forecasts'),
('forecast.submit','Submit forecasts'),
('forecast.approve','Approve forecasts'),
('scenario.view','View scenarios'),
('scenario.edit','Edit scenarios'),
('reports.view','View reports'),
('ai.view','Use AI analyst'),
('users.manage','Manage organization users')
on conflict (action) do nothing;

comment on table financial_facts is 'Canonical financial fact store. amount_minor is authoritative integer minor currency units; no floating-point monetary storage.';
comment on column financial_facts.amount_minor is 'Integer minor units (for example halala/cents), avoiding floating-point monetary arithmetic.';
comment on table organizations is 'Tenant root. All tenant-owned records must be scoped to this organization.';
