-- P0-2 security test harness
-- Run only against a disposable Supabase test database/branch.
-- This file intentionally does not create users or mutate production data.
-- The runner must execute each assertion while authenticated as the relevant test user.

begin;

-- Required schema contract checks.
do $$
begin
  if to_regclass('public.organizations') is null then raise exception 'Missing organizations'; end if;
  if to_regclass('public.organization_members') is null then raise exception 'Missing organization_members'; end if;
  if to_regclass('public.organization_member_scopes') is null then raise exception 'Missing organization_member_scopes'; end if;
  if to_regclass('public.organization_member_permission_overrides') is null then raise exception 'Missing permission overrides'; end if;
  if to_regclass('public.organization_role_permissions') is null then raise exception 'Missing role permissions'; end if;
  if to_regclass('public.financial_facts') is null then raise exception 'Missing financial_facts'; end if;
end $$;

-- Authorization contract: membership is required by the permission evaluator.
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'has_org_permission'
  ) then
    raise exception 'Missing has_org_permission()';
  end if;
end $$;

-- Scope contract: financial_facts must expose a scoped SELECT policy.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_facts'
      and policyname = 'financial_facts_scoped_select'
      and cmd = 'SELECT'
  ) then
    raise exception 'Missing financial_facts_scoped_select policy';
  end if;
end $$;

-- Audit contract: direct client inserts must not be granted.
do $$
begin
  if has_table_privilege('authenticated', 'public.audit_events', 'INSERT') then
    raise exception 'authenticated still has direct INSERT on audit_events';
  end if;
  if has_table_privilege('anon', 'public.audit_events', 'INSERT') then
    raise exception 'anon still has direct INSERT on audit_events';
  end if;
end $$;

-- Publish write-boundary contract.
do $$
begin
  if has_table_privilege('authenticated', 'public.financial_facts', 'INSERT') then
    raise exception 'authenticated still has direct INSERT on financial_facts';
  end if;
  if not has_function_privilege('authenticated', 'public.publish_actuals_from_import(uuid,text)', 'EXECUTE') then
    raise exception 'authenticated cannot execute publish_actuals_from_import';
  end if;
  if has_function_privilege('anon', 'public.publish_actuals_from_import(uuid,text)', 'EXECUTE') then
    raise exception 'anon can execute publish_actuals_from_import';
  end if;
end $$;

rollback;

-- Runtime test scenarios to execute in a disposable database with two authenticated users:
-- 1. User A is a member of Organization A only: Organization B rows must be invisible.
-- 2. User B is a member of Organization B only: Organization A rows must be invisible.
-- 3. A scoped User A with Branch A scope can read Branch A financial_facts but not Branch B.
-- 4. A user with an explicit permission deny override cannot perform that action even if its role grants it.
-- 5. An explicit grant override restores that permission when membership exists.
-- 6. Direct INSERT into financial_facts by authenticated clients must fail.
-- 7. Direct INSERT into audit_events by authenticated clients must fail.
-- 8. publish_actuals_from_import must fail without the import permission.
-- 9. publish_actuals_from_import must succeed only through the authorized publish boundary.
