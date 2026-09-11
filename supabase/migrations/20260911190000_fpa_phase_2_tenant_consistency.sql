-- Phase 2: strengthen the canonical financial model against cross-tenant references.
-- The base financial tables already exist in the Supabase project. This migration
-- adds composite tenant-aware foreign keys and reporting indexes.

create unique index if not exists accounts_org_id_uidx
  on public.accounts (organization_id, id);
create unique index if not exists financial_periods_org_id_uidx
  on public.financial_periods (organization_id, id);
create unique index if not exists legal_entities_org_id_uidx
  on public.legal_entities (organization_id, id);
create unique index if not exists branches_org_id_uidx
  on public.branches (organization_id, id);
create unique index if not exists departments_org_id_uidx
  on public.departments (organization_id, id);
create unique index if not exists cost_centers_org_id_uidx
  on public.cost_centers (organization_id, id);
create unique index if not exists regions_org_id_uidx
  on public.regions (organization_id, id);
create unique index if not exists products_org_id_uidx
  on public.products (organization_id, id);
create unique index if not exists projects_org_id_uidx
  on public.projects (organization_id, id);
create unique index if not exists imports_org_id_uidx
  on public.imports (organization_id, id);
create unique index if not exists planning_versions_org_id_uidx
  on public.planning_versions (organization_id, id);

alter table public.financial_facts
  add constraint financial_facts_account_same_org_fk
  foreign key (organization_id, account_id)
  references public.accounts (organization_id, id)
  not valid;

alter table public.financial_facts
  add constraint financial_facts_period_same_org_fk
  foreign key (organization_id, financial_period_id)
  references public.financial_periods (organization_id, id)
  not valid;

alter table public.financial_facts
  add constraint financial_facts_legal_entity_same_org_fk
  foreign key (organization_id, legal_entity_id)
  references public.legal_entities (organization_id, id)
  not valid;

alter table public.financial_facts
  add constraint financial_facts_branch_same_org_fk
  foreign key (organization_id, branch_id)
  references public.branches (organization_id, id)
  not valid;

alter table public.financial_facts
  add constraint financial_facts_department_same_org_fk
  foreign key (organization_id, department_id)
  references public.departments (organization_id, id)
  not valid;

alter table public.financial_facts
  add constraint financial_facts_cost_center_same_org_fk
  foreign key (organization_id, cost_center_id)
  references public.cost_centers (organization_id, id)
  not valid;

alter table public.financial_facts
  add constraint financial_facts_region_same_org_fk
  foreign key (organization_id, region_id)
  references public.regions (organization_id, id)
  not valid;

alter table public.financial_facts
  add constraint financial_facts_product_same_org_fk
  foreign key (organization_id, product_id)
  references public.products (organization_id, id)
  not valid;

alter table public.financial_facts
  add constraint financial_facts_project_same_org_fk
  foreign key (organization_id, project_id)
  references public.projects (organization_id, id)
  not valid;

alter table public.financial_facts
  add constraint financial_facts_import_same_org_fk
  foreign key (organization_id, source_import_id)
  references public.imports (organization_id, id)
  not valid;

alter table public.financial_facts
  add constraint financial_facts_planning_version_same_org_fk
  foreign key (organization_id, planning_version_id)
  references public.planning_versions (organization_id, id)
  not valid;

create index if not exists financial_facts_org_fact_type_period_idx
  on public.financial_facts (organization_id, fact_type, financial_period_id);

create index if not exists financial_facts_org_dimensions_idx
  on public.financial_facts (
    organization_id,
    legal_entity_id,
    branch_id,
    department_id,
    cost_center_id,
    region_id,
    project_id
  );
