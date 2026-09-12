create table if not exists public.forecast_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  planning_version_id uuid not null references public.planning_versions(id) on delete cascade,
  financial_period_id uuid not null references public.financial_periods(id) on delete restrict,
  account_id uuid not null references public.accounts(id) on delete restrict,
  amount_minor bigint not null,
  legal_entity_id uuid,
  branch_id uuid,
  department_id uuid,
  cost_center_id uuid,
  region_id uuid,
  product_id uuid,
  project_id uuid,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planning_version_id, financial_period_id, account_id, legal_entity_id, branch_id, department_id, cost_center_id, region_id, product_id, project_id)
);

create index if not exists forecast_lines_org_version_idx on public.forecast_lines(organization_id, planning_version_id);
create index if not exists forecast_lines_period_idx on public.forecast_lines(financial_period_id);
alter table public.forecast_lines enable row level security;

drop policy if exists forecast_lines_select on public.forecast_lines;
create policy forecast_lines_select on public.forecast_lines for select using (public.has_org_permission(organization_id,'view'));
drop policy if exists forecast_lines_insert on public.forecast_lines;
create policy forecast_lines_insert on public.forecast_lines for insert with check (public.has_org_permission(organization_id,'manage_budget') and created_by=auth.uid());
drop policy if exists forecast_lines_update on public.forecast_lines;
create policy forecast_lines_update on public.forecast_lines for update using (public.has_org_permission(organization_id,'manage_budget')) with check (public.has_org_permission(organization_id,'manage_budget'));
drop policy if exists forecast_lines_delete on public.forecast_lines;
create policy forecast_lines_delete on public.forecast_lines for delete using (public.has_org_permission(organization_id,'manage_budget'));

create or replace function public.get_forecast_workspace(p_organization_id uuid, p_planning_version_id uuid default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid := auth.uid(); v_version uuid; v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.has_org_permission(p_organization_id,'view') then raise exception 'Not authorized'; end if;
  if p_planning_version_id is not null then
    select id into v_version from public.planning_versions where id=p_planning_version_id and organization_id=p_organization_id and version_type='forecast';
    if v_version is null then raise exception 'Forecast version not found'; end if;
  else
    select id into v_version from public.planning_versions where organization_id=p_organization_id and version_type='forecast' order by created_at desc limit 1;
  end if;
  select jsonb_build_object(
    'version', (select to_jsonb(v) from public.planning_versions v where v.id=v_version),
    'periods', coalesce((select jsonb_agg(to_jsonb(p) order by p.period_start) from public.financial_periods p where p.organization_id=p_organization_id),'[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(to_jsonb(a) order by a.code) from public.accounts a where a.organization_id=p_organization_id),'[]'::jsonb),
    'lines', coalesce((select jsonb_agg(to_jsonb(fl) order by fl.financial_period_id, fl.account_id) from public.forecast_lines fl where fl.organization_id=p_organization_id and fl.planning_version_id=v_version),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.upsert_forecast_line(p_organization_id uuid,p_planning_version_id uuid,p_financial_period_id uuid,p_account_id uuid,p_amount_minor bigint,p_legal_entity_id uuid default null,p_branch_id uuid default null,p_department_id uuid default null,p_cost_center_id uuid default null,p_region_id uuid default null,p_product_id uuid default null,p_project_id uuid default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.has_org_permission(p_organization_id,'manage_budget') then raise exception 'forbidden'; end if;
 if not exists(select 1 from public.planning_versions where id=p_planning_version_id and organization_id=p_organization_id and version_type='forecast' and status in ('draft','changes_requested')) then raise exception 'forecast must be editable'; end if;
 if not exists(select 1 from public.financial_periods where id=p_financial_period_id and organization_id=p_organization_id) then raise exception 'invalid period'; end if;
 if not exists(select 1 from public.accounts where id=p_account_id and organization_id=p_organization_id) then raise exception 'invalid account'; end if;
 insert into public.forecast_lines(organization_id,planning_version_id,financial_period_id,account_id,amount_minor,legal_entity_id,branch_id,department_id,cost_center_id,region_id,product_id,project_id,notes,created_by)
 values(p_organization_id,p_planning_version_id,p_financial_period_id,p_account_id,p_amount_minor,p_legal_entity_id,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_notes,auth.uid())
 on conflict (planning_version_id,financial_period_id,account_id,legal_entity_id,branch_id,department_id,cost_center_id,region_id,product_id,project_id) do update set amount_minor=excluded.amount_minor,notes=excluded.notes,updated_at=now()
 returning id into v_id;
 return v_id;
end;
$$;

create or replace function public.delete_forecast_line(p_organization_id uuid,p_forecast_line_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.has_org_permission(p_organization_id,'manage_budget') then raise exception 'forbidden'; end if;
 delete from public.forecast_lines f where f.id=p_forecast_line_id and f.organization_id=p_organization_id and exists(select 1 from public.planning_versions v where v.id=f.planning_version_id and v.organization_id=p_organization_id and v.version_type='forecast' and v.status in ('draft','changes_requested'));
end;
$$;

revoke all on public.forecast_lines from anon;
grant select on public.forecast_lines to authenticated;
revoke all on function public.get_forecast_workspace(uuid,uuid) from public,anon;
grant execute on function public.get_forecast_workspace(uuid,uuid) to authenticated;
revoke all on function public.upsert_forecast_line(uuid,uuid,uuid,uuid,bigint,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.upsert_forecast_line(uuid,uuid,uuid,uuid,bigint,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text) to authenticated;
revoke all on function public.delete_forecast_line(uuid,uuid) from public,anon;
grant execute on function public.delete_forecast_line(uuid,uuid) to authenticated;
