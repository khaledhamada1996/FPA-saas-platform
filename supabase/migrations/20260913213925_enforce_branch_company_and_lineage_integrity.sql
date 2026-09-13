create unique index if not exists legal_entities_org_id_id_key
  on public.legal_entities (organization_id, id);

alter table public.branches
  add constraint branches_legal_entity_same_org_fk
  foreign key (organization_id, legal_entity_id)
  references public.legal_entities (organization_id, id)
  on delete set null;

alter table public.financial_facts
  validate constraint financial_facts_branch_same_org_fk;

alter table public.branches
  validate constraint branches_legal_entity_same_org_fk;

create index if not exists branches_organization_id_idx
  on public.branches (organization_id);

create index if not exists financial_facts_branch_org_idx
  on public.financial_facts (organization_id, branch_id);
