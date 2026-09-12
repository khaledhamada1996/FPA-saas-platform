create table if not exists public.planning_approval_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  policy_code text not null check (policy_code in ('self','finance','finance_ceo','finance_ceo_board')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table if not exists public.planning_approval_steps (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.planning_approval_policies(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  step_name text not null,
  required_role_key text,
  required_permission_key text not null default 'approve',
  allow_submitter boolean not null default false,
  created_at timestamptz not null default now(),
  unique (policy_id, step_order)
);

create table if not exists public.planning_version_approval_steps (
  id uuid primary key default gen_random_uuid(),
  planning_version_id uuid not null references public.planning_versions(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  step_name text not null,
  required_role_key text,
  required_permission_key text not null default 'approve',
  assigned_to uuid references auth.users(id),
  status text not null default 'pending' check (status in ('pending','approved','changes_requested','rejected','skipped')),
  decision_note text,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (planning_version_id, step_order)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.planning_approval_policies enable row level security;
alter table public.planning_approval_steps enable row level security;
alter table public.planning_version_approval_steps enable row level security;
alter table public.notifications enable row level security;

revoke all on public.planning_approval_policies from anon, authenticated;
revoke all on public.planning_approval_steps from anon, authenticated;
revoke all on public.planning_version_approval_steps from anon, authenticated;
revoke all on public.notifications from anon, authenticated;

create or replace function public.configure_planning_approval_policy(p_organization_id uuid, p_policy_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := (select auth.uid());
  v_policy uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.has_org_permission(p_organization_id, 'manage_settings') then raise exception 'Not authorized'; end if;
  if p_policy_code not in ('self','finance','finance_ceo','finance_ceo_board') then raise exception 'Invalid approval policy'; end if;

  insert into public.planning_approval_policies(organization_id, policy_code, created_by, updated_at)
  values (p_organization_id, p_policy_code, v_user, now())
  on conflict (organization_id) do update set policy_code=excluded.policy_code, is_active=true, updated_at=now();

  select id into v_policy from public.planning_approval_policies where organization_id=p_organization_id;
  delete from public.planning_approval_steps where policy_id=v_policy;

  if p_policy_code='self' then
    insert into public.planning_approval_steps(policy_id,step_order,step_name,allow_submitter) values(v_policy,1,'Self approval',true);
  elsif p_policy_code='finance' then
    insert into public.planning_approval_steps(policy_id,step_order,step_name,required_role_key) values(v_policy,1,'Finance approval','cfo');
  elsif p_policy_code='finance_ceo' then
    insert into public.planning_approval_steps(policy_id,step_order,step_name,required_role_key) values(v_policy,1,'Finance approval','cfo'),(v_policy,2,'CEO approval','ceo');
  else
    insert into public.planning_approval_steps(policy_id,step_order,step_name,required_role_key) values(v_policy,1,'Finance approval','cfo'),(v_policy,2,'CEO approval','ceo'),(v_policy,3,'Board approval','board');
  end if;
  return v_policy;
end;
$$;

revoke all on function public.configure_planning_approval_policy(uuid,text) from public, anon;
grant execute on function public.configure_planning_approval_policy(uuid,text) to authenticated;

create or replace function public.get_planning_approval_policy(p_organization_id uuid)
returns table(policy_code text,step_order integer,step_name text,required_role_key text,allow_submitter boolean)
language sql
security invoker
set search_path=public,pg_temp
as $$
  select p.policy_code,s.step_order,s.step_name,s.required_role_key,s.allow_submitter
  from public.planning_approval_policies p
  join public.planning_approval_steps s on s.policy_id=p.id
  where p.organization_id=p_organization_id
    and p.is_active
    and public.has_org_permission(p_organization_id,'view')
  order by s.step_order;
$$;

revoke all on function public.get_planning_approval_policy(uuid) from public, anon;
grant execute on function public.get_planning_approval_policy(uuid) to authenticated;
