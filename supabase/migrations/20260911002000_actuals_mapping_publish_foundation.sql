create table if not exists public.account_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_code text not null,
  source_name text not null,
  target_account_id uuid not null,
  status text not null default 'approved' check (status in ('draft','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_code)
);

create index if not exists account_mappings_org_idx on public.account_mappings (organization_id);
create index if not exists account_mappings_target_idx on public.account_mappings (organization_id, target_account_id);

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  row_number integer not null,
  source_key text not null,
  payload jsonb not null,
  validation_status text not null default 'valid' check (validation_status in ('pending','valid','warning','error')),
  validation_message text,
  created_at timestamptz not null default now(),
  unique (import_id, row_number),
  unique (organization_id, source_key)
);

create index if not exists import_rows_import_idx on public.import_rows (import_id, row_number);
create index if not exists import_rows_org_idx on public.import_rows (organization_id);

create table if not exists public.actuals_publish_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_id uuid not null references public.imports(id) on delete restrict,
  mapping_version text not null,
  status text not null default 'published' check (status in ('published','rejected')),
  row_count integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists actuals_publish_batches_org_idx on public.actuals_publish_batches (organization_id, created_at desc);

alter table public.account_mappings enable row level security;
alter table public.import_rows enable row level security;
alter table public.actuals_publish_batches enable row level security;

revoke all on public.account_mappings from anon, authenticated;
revoke all on public.import_rows from anon, authenticated;
revoke all on public.actuals_publish_batches from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='account_mappings' and policyname='members can read account mappings') then
    create policy "members can read account mappings" on public.account_mappings for select to authenticated
      using (exists (select 1 from public.organization_members m where m.organization_id = account_mappings.organization_id and m.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='import_rows' and policyname='members can read import rows') then
    create policy "members can read import rows" on public.import_rows for select to authenticated
      using (exists (select 1 from public.organization_members m where m.organization_id = import_rows.organization_id and m.user_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='actuals_publish_batches' and policyname='members can read actuals publish batches') then
    create policy "members can read actuals publish batches" on public.actuals_publish_batches for select to authenticated
      using (exists (select 1 from public.organization_members m where m.organization_id = actuals_publish_batches.organization_id and m.user_id = (select auth.uid())));
  end if;
end $$;
