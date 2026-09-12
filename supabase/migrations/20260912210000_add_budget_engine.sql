create table if not exists public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  planning_version_id uuid not null references public.planning_versions(id) on delete cascade,
  financial_period_id uuid not null references public.financial_periods(id) on delete restrict,
  account_id uuid not null references public.accounts(id) on delete restrict,
  legal_entity_id uuid null references public.legal_entities(id) on delete restrict,
  branch_id uuid null references public.branches(id) on delete restrict,
  department_id uuid null references public.departments(id) on delete restrict,
  cost_center_id uuid null references public.cost_centers(id) on delete restrict,
  region_id uuid null references public.regions(id) on delete restrict,
  product_id uuid null references public.products(id) on delete restrict,
  project_id uuid null references public.projects(id) on delete restrict,
  amount_minor bigint not null default 0,
  currency char(3) not null default 'SAR',
  notes text null,
  created_by uuid null references auth.users(id),
  updated_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_lines_currency_chk check (currency ~ '^[A-Z]{3}$')
);

create index if not exists budget_lines_org_version_idx on public.budget_lines(organization_id, planning_version_id);
create index if not exists budget_lines_period_idx on public.budget_lines(organization_id, financial_period_id);
create index if not exists budget_lines_account_idx on public.budget_lines(organization_id, account_id);

alter table public.budget_lines enable row level security;
revoke all on table public.budget_lines from anon, authenticated;
grant select, insert, update, delete on table public.budget_lines to authenticated;

create policy budget_lines_select on public.budget_lines for select to authenticated using (public.has_org_permission(organization_id,'view'));
create policy budget_lines_insert on public.budget_lines for insert to authenticated with check (public.has_org_permission(organization_id,'manage_budget'));
create policy budget_lines_update on public.budget_lines for update to authenticated using (public.has_org_permission(organization_id,'manage_budget')) with check (public.has_org_permission(organization_id,'manage_budget'));
create policy budget_lines_delete on public.budget_lines for delete to authenticated using (public.has_org_permission(organization_id,'manage_budget'));

create or replace function public.get_budget_workspace(p_organization_id uuid, p_planning_version_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_version uuid; v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.has_org_permission(p_organization_id,'view') then raise exception 'Not authorized'; end if;
  if p_planning_version_id is not null then
    select id into v_version from public.planning_versions where id=p_planning_version_id and organization_id=p_organization_id and version_type='budget';
    if v_version is null then raise exception 'Budget version not found'; end if;
  else
    select id into v_version from public.planning_versions where organization_id=p_organization_id and version_type='budget' order by created_at desc limit 1;
  end if;
  select jsonb_build_object(
    'version',(select to_jsonb(v) from public.planning_versions v where v.id=v_version),
    'periods',coalesce((select jsonb_agg(to_jsonb(p) order by p.period_start) from public.financial_periods p where p.organization_id=p_organization_id),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(to_jsonb(a) order by a.code) from public.accounts a where a.organization_id=p_organization_id),'[]'::jsonb),
    'lines',coalesce((select jsonb_agg(to_jsonb(bl) order by bl.financial_period_id,bl.account_id) from public.budget_lines bl where bl.organization_id=p_organization_id and bl.planning_version_id=v_version),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

create or replace function public.upsert_budget_line(p_organization_id uuid,p_planning_version_id uuid,p_financial_period_id uuid,p_account_id uuid,p_amount_minor bigint,p_legal_entity_id uuid default null,p_branch_id uuid default null,p_department_id uuid default null,p_cost_center_id uuid default null,p_region_id uuid default null,p_product_id uuid default null,p_project_id uuid default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid; v_currency char(3); v_status text; v_zero uuid := '00000000-0000-0000-0000-000000000000';
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.has_org_permission(p_organization_id,'manage_budget') then raise exception 'Not authorized'; end if;
  select status into v_status from public.planning_versions where id=p_planning_version_id and organization_id=p_organization_id and version_type='budget' for update;
  if v_status is null then raise exception 'Budget version not found'; end if;
  if v_status not in ('draft','changes_requested') then raise exception 'Budget version is locked for editing'; end if;
  if not exists(select 1 from public.financial_periods where id=p_financial_period_id and organization_id=p_organization_id) then raise exception 'Financial period does not belong to organization'; end if;
  if not exists(select 1 from public.accounts where id=p_account_id and organization_id=p_organization_id) then raise exception 'Account does not belong to organization'; end if;
  if p_legal_entity_id is not null and not exists(select 1 from public.legal_entities where id=p_legal_entity_id and organization_id=p_organization_id) then raise exception 'Legal entity does not belong to organization'; end if;
  if p_branch_id is not null and not exists(select 1 from public.branches where id=p_branch_id and organization_id=p_organization_id) then raise exception 'Branch does not belong to organization'; end if;
  if p_department_id is not null and not exists(select 1 from public.departments where id=p_department_id and organization_id=p_organization_id) then raise exception 'Department does not belong to organization'; end if;
  if p_cost_center_id is not null and not exists(select 1 from public.cost_centers where id=p_cost_center_id and organization_id=p_organization_id) then raise exception 'Cost center does not belong to organization'; end if;
  if p_region_id is not null and not exists(select 1 from public.regions where id=p_region_id and organization_id=p_organization_id) then raise exception 'Region does not belong to organization'; end if;
  if p_product_id is not null and not exists(select 1 from public.products where id=p_product_id and organization_id=p_organization_id) then raise exception 'Product does not belong to organization'; end if;
  if p_project_id is not null and not exists(select 1 from public.projects where id=p_project_id and organization_id=p_organization_id) then raise exception 'Project does not belong to organization'; end if;
  select base_currency into v_currency from public.organizations where id=p_organization_id;
  select id into v_id from public.budget_lines where organization_id=p_organization_id and planning_version_id=p_planning_version_id and financial_period_id=p_financial_period_id and account_id=p_account_id and coalesce(legal_entity_id,v_zero)=coalesce(p_legal_entity_id,v_zero) and coalesce(branch_id,v_zero)=coalesce(p_branch_id,v_zero) and coalesce(department_id,v_zero)=coalesce(p_department_id,v_zero) and coalesce(cost_center_id,v_zero)=coalesce(p_cost_center_id,v_zero) and coalesce(region_id,v_zero)=coalesce(p_region_id,v_zero) and coalesce(product_id,v_zero)=coalesce(p_product_id,v_zero) and coalesce(project_id,v_zero)=coalesce(p_project_id,v_zero) limit 1 for update;
  if v_id is null then insert into public.budget_lines(organization_id,planning_version_id,financial_period_id,account_id,legal_entity_id,branch_id,department_id,cost_center_id,region_id,product_id,project_id,amount_minor,currency,notes,created_by,updated_by) values(p_organization_id,p_planning_version_id,p_financial_period_id,p_account_id,p_legal_entity_id,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_amount_minor,v_currency,p_notes,v_user,v_user) returning id into v_id;
  else update public.budget_lines set amount_minor=p_amount_minor,notes=p_notes,updated_by=v_user,updated_at=now() where id=v_id; end if;
  return v_id;
end; $$;

create or replace function public.delete_budget_line(p_organization_id uuid,p_budget_line_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_org_permission(p_organization_id,'manage_budget') then raise exception 'Not authorized'; end if;
  delete from public.budget_lines bl using public.planning_versions pv where bl.id=p_budget_line_id and bl.organization_id=p_organization_id and pv.id=bl.planning_version_id and pv.organization_id=p_organization_id and pv.version_type='budget' and pv.status in ('draft','changes_requested');
  if not found then raise exception 'Budget line not found or not editable'; end if;
end; $$;

create or replace function public.get_budget_summary(p_organization_id uuid,p_planning_version_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_org_permission(p_organization_id,'view') then raise exception 'Not authorized'; end if;
  if not exists(select 1 from public.planning_versions where id=p_planning_version_id and organization_id=p_organization_id and version_type='budget') then raise exception 'Budget version not found'; end if;
  select jsonb_build_object('total_minor',coalesce(sum(bl.amount_minor),0),'line_count',count(*),'period_count',count(distinct bl.financial_period_id),'account_count',count(distinct bl.account_id)) into v from public.budget_lines bl where bl.organization_id=p_organization_id and bl.planning_version_id=p_planning_version_id;
  return v;
end; $$;

revoke all on function public.get_budget_workspace(uuid,uuid) from public,anon;
revoke all on function public.upsert_budget_line(uuid,uuid,uuid,uuid,bigint,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text) from public,anon;
revoke all on function public.delete_budget_line(uuid,uuid) from public,anon;
revoke all on function public.get_budget_summary(uuid,uuid) from public,anon;
grant execute on function public.get_budget_workspace(uuid,uuid) to authenticated;
grant execute on function public.upsert_budget_line(uuid,uuid,uuid,uuid,bigint,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text) to authenticated;
grant execute on function public.delete_budget_line(uuid,uuid) to authenticated;
grant execute on function public.get_budget_summary(uuid,uuid) to authenticated;

create or replace function public.submit_planning_version(p_planning_version_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_org uuid; v_status text; v_creator uuid; v_type text; v_policy public.planning_approval_policies%rowtype; v_step record;
begin
 select pv.organization_id,pv.status,pv.created_by,pv.version_type into v_org,v_status,v_creator,v_type from public.planning_versions pv where pv.id=p_planning_version_id for update;
 if v_user is null then raise exception 'Authentication required'; end if;
 if v_org is null then raise exception 'Planning version not found'; end if;
 if not public.has_org_permission(v_org,'submit') then raise exception 'Not authorized'; end if;
 if v_creator is distinct from v_user then raise exception 'Only the creator can submit this planning version'; end if;
 if v_status not in ('draft','changes_requested') then raise exception 'Planning version is not editable for submission'; end if;
 if v_type='budget' and not exists(select 1 from public.budget_lines where planning_version_id=p_planning_version_id and organization_id=v_org) then raise exception 'Budget cannot be submitted without at least one budget line'; end if;
 select * into v_policy from public.planning_approval_policies p where p.organization_id=v_org and p.is_active=true;
 if not found then raise exception 'Approval policy is not configured'; end if;
 if not exists(select 1 from public.planning_approval_steps s where s.policy_id=v_policy.id) then raise exception 'Approval policy has no approval steps'; end if;
 delete from public.planning_version_approval_steps where planning_version_id=p_planning_version_id;
 for v_step in select s.* from public.planning_approval_steps s where s.policy_id=v_policy.id order by s.step_order loop insert into public.planning_version_approval_steps(planning_version_id,step_order,step_name,required_role_key,required_permission_key,allow_submitter,status) values(p_planning_version_id,v_step.step_order,v_step.step_name,v_step.required_role_key,v_step.required_permission_key,v_step.allow_submitter,case when v_step.step_order=1 then 'pending' else 'skipped' end); end loop;
 update public.planning_versions set status='submitted',submitted_by=v_user,submitted_at=now(),review_note=null where id=p_planning_version_id;
 for v_step in select s.* from public.planning_version_approval_steps s where s.planning_version_id=p_planning_version_id and s.step_order=1 loop if v_step.required_role_key is null then insert into public.notifications(organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id) values(v_org,v_user,'planning_review','Plan ready for approval','Your planning version is ready for approval.','planning_version',p_planning_version_id); else insert into public.notifications(organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id) select v_org,m.user_id,'planning_review','Plan awaiting your review','A planning version is waiting for your review and approval.','planning_version',p_planning_version_id from public.organization_members m where m.organization_id=v_org and coalesce(m.role_key,m.role)=v_step.required_role_key; end if; end loop;
end; $$;