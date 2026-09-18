-- Journal management: list, inspect, and versioned amendment of published actual journals.
-- Applied to Supabase production before syncing this ledger migration.

create or replace function public.get_journal_entries(
  p_organization_id uuid, p_start_date date default null, p_end_date date default null,
  p_journal_no text default null, p_account_id uuid default null, p_branch_id uuid default null,
  p_department_id uuid default null, p_cost_center_id uuid default null, p_region_id uuid default null,
  p_product_id uuid default null, p_project_id uuid default null, p_limit integer default 100, p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path='' as $$ begin return public.get_journal_entries(p_organization_id,p_start_date,p_end_date,p_journal_no,p_account_id,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_limit,p_offset); end; $$;
-- The full production definitions are maintained in the applied migration history; this file is a ledger marker only.
