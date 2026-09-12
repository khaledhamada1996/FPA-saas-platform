alter table public.planning_version_approval_steps
  add column if not exists allow_submitter boolean not null default false;
