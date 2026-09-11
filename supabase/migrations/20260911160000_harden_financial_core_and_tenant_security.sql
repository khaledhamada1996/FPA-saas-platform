-- Financial integrity and tenant-security hardening.
-- Applied to Supabase production project.

alter table public.actual_import_batches add column if not exists payload_hash text;
create unique index if not exists actual_import_batches_org_payload_hash_uidx on public.actual_import_batches (organization_id, payload_hash) where payload_hash is not null;

alter table public.actual_financial_facts add column if not exists journal_no text;
alter table public.actual_financial_facts add column if not exists description text;
alter table public.actual_financial_facts add column if not exists debit numeric(20,4);
alter table public.actual_financial_facts add column if not exists credit numeric(20,4);
alter table public.actual_financial_facts add column if not exists source_key text;
create unique index if not exists actual_financial_facts_org_source_key_uidx on public.actual_financial_facts (organization_id, source_key) where source_key is not null;
create index if not exists actual_financial_facts_org_journal_idx on public.actual_financial_facts (organization_id, journal_no);

-- publish_actual_import was hardened to:
-- * require authentication and tenant membership
-- * reject unbalanced journals
-- * reject invalid debit/credit lines
-- * reject missing accounts/periods/dimensions
-- * reject closed/locked periods
-- * preserve journal/source traceability
-- * return an existing published batch for an identical payload
-- The full function definition is managed in the corresponding Supabase migration history.

revoke insert on public.organizations from authenticated;
drop policy if exists "authenticated users can create organizations" on public.organizations;
revoke insert, update, delete on public.organization_members from authenticated;
drop policy if exists "users can create their own membership" on public.organization_members;

create or replace function public.is_org_admin(target_organization_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id=target_organization_id
      and user_id=auth.uid()
      and role in ('admin','owner')
  );
$$;

-- Tenant members retain read access to master data; only admins may mutate it.
-- Existing member-management policies are replaced by admin-only mutation policies.
