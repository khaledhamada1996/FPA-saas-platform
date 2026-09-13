-- Group reporting mapping is exposed only through SECURITY DEFINER RPCs.
alter table public.group_reporting_accounts enable row level security;
alter table public.group_account_mappings enable row level security;
drop policy if exists group_reporting_accounts_deny_direct on public.group_reporting_accounts;
create policy group_reporting_accounts_deny_direct on public.group_reporting_accounts for all to authenticated using (false) with check (false);
drop policy if exists group_account_mappings_deny_direct on public.group_account_mappings;
create policy group_account_mappings_deny_direct on public.group_account_mappings for all to authenticated using (false) with check (false);
revoke all on public.group_reporting_accounts from anon,authenticated;
revoke all on public.group_account_mappings from anon,authenticated;
