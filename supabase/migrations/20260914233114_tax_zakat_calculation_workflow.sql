create table if not exists public.tax_zakat_calculations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 period_id uuid not null references public.financial_periods(id) on delete restrict,
 status text not null default 'draft' check (status in ('draft','reviewed','approved','locked')),
 engine_version text not null,
 rule_codes text[] not null default '{}',
 inputs jsonb not null default '{}'::jsonb,
 result jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id),
 reviewed_by uuid references auth.users(id),
 approved_by uuid references auth.users(id),
 locked_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 approved_at timestamptz,
 locked_at timestamptz,
 updated_at timestamptz not null default now()
);
create index if not exists idx_tax_zakat_calculations_org_period on public.tax_zakat_calculations(organization_id,period_id,created_at desc);
alter table public.tax_zakat_calculations enable row level security;
revoke all on public.tax_zakat_calculations from anon;
grant select,insert,update on public.tax_zakat_calculations to authenticated;
drop policy if exists tax_zakat_calculations_select on public.tax_zakat_calculations;
create policy tax_zakat_calculations_select on public.tax_zakat_calculations for select to authenticated using (public.has_org_permission(organization_id,'screen.financial_statements.view') or public.has_org_permission(organization_id,'statements.view') or public.has_org_permission(organization_id,'view'));
drop policy if exists tax_zakat_calculations_insert on public.tax_zakat_calculations;
create policy tax_zakat_calculations_insert on public.tax_zakat_calculations for insert to authenticated with check (public.has_org_permission(organization_id,'screen.financial_statements.edit') or public.has_org_permission(organization_id,'statements.edit') or public.has_org_permission(organization_id,'admin'));
drop policy if exists tax_zakat_calculations_update on public.tax_zakat_calculations;
create policy tax_zakat_calculations_update on public.tax_zakat_calculations for update to authenticated using (public.has_org_permission(organization_id,'screen.financial_statements.edit') or public.has_org_permission(organization_id,'statements.edit') or public.has_org_permission(organization_id,'admin')) with check (public.has_org_permission(organization_id,'screen.financial_statements.edit') or public.has_org_permission(organization_id,'statements.edit') or public.has_org_permission(organization_id,'admin'));
alter table public.tax_zakat_adjustments add column if not exists calculation_id uuid references public.tax_zakat_calculations(id) on delete set null;
create index if not exists idx_tax_zakat_adjustments_calculation on public.tax_zakat_adjustments(calculation_id);

create or replace function public.create_tax_zakat_calculation(p_organization_id uuid,p_period_id uuid,p_branch_id uuid,p_department_id uuid,p_cost_center_id uuid,p_region_id uuid,p_product_id uuid,p_project_id uuid,p_regime text,p_zakat_method text,p_saudi_ownership_percent numeric,p_income_tax_rate numeric,p_zakat_rate numeric) returns jsonb language plpgsql security definer set search_path='' as $function$
declare r jsonb; v_id uuid; v_codes text[];
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not (public.has_org_permission(p_organization_id,'screen.financial_statements.edit') or public.has_org_permission(p_organization_id,'statements.edit') or public.has_org_permission(p_organization_id,'admin')) then raise exception 'Financial statements edit permission required'; end if;
 r:=public.calculate_tax_zakat_engine(p_organization_id,p_period_id,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_regime,p_zakat_method,p_saudi_ownership_percent,p_income_tax_rate,p_zakat_rate);
 select coalesce(array_agg(rule_code order by rule_code),'{}') into v_codes from public.tax_zakat_rule_versions where effective_from <= current_date and (effective_to is null or effective_to >= current_date);
 insert into public.tax_zakat_calculations(organization_id,period_id,status,engine_version,rule_codes,inputs,result,created_by) values(p_organization_id,p_period_id,'draft',coalesce(r->>'engine_version','unknown'),v_codes,jsonb_build_object('regime',p_regime,'zakat_method',p_zakat_method,'saudi_ownership_percent',p_saudi_ownership_percent,'income_tax_rate',p_income_tax_rate,'zakat_rate',p_zakat_rate,'branch_id',p_branch_id,'department_id',p_department_id,'cost_center_id',p_cost_center_id,'region_id',p_region_id,'product_id',p_product_id,'project_id',p_project_id),r,auth.uid()) returning id into v_id;
 return jsonb_build_object('id',v_id,'status','draft','result',r);
end;$function$;
revoke all on function public.create_tax_zakat_calculation(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,numeric,numeric,numeric) from public,anon;
grant execute on function public.create_tax_zakat_calculation(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,numeric,numeric,numeric) to authenticated;

create or replace function public.transition_tax_zakat_calculation(p_calculation_id uuid,p_target_status text) returns jsonb language plpgsql security definer set search_path='' as $function$
declare c public.tax_zakat_calculations%rowtype; ready boolean; now_ts timestamptz:=now();
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into c from public.tax_zakat_calculations where id=p_calculation_id;
 if not found then raise exception 'Calculation not found'; end if;
 if not (public.has_org_permission(c.organization_id,'screen.financial_statements.edit') or public.has_org_permission(c.organization_id,'statements.edit') or public.has_org_permission(c.organization_id,'admin')) then raise exception 'Financial statements edit permission required'; end if;
 ready:=coalesce((c.result->'completeness'->>'ready')::boolean,false);
 if p_target_status not in ('reviewed','approved','locked') then raise exception 'Invalid target status'; end if;
 if c.status='locked' then raise exception 'Locked calculation cannot be changed'; end if;
 if p_target_status in ('approved','locked') and not ready then raise exception 'Calculation is not ready: incomplete mappings or reconciliation'; end if;
 if p_target_status='approved' and c.status<>'reviewed' then raise exception 'Calculation must be reviewed before approval'; end if;
 if p_target_status='locked' and c.status<>'approved' then raise exception 'Calculation must be approved before locking'; end if;
 if p_target_status='reviewed' and c.status<>'draft' then raise exception 'Only draft calculations can be reviewed'; end if;
 update public.tax_zakat_calculations set status=p_target_status,reviewed_by=case when p_target_status='reviewed' then auth.uid() else reviewed_by end,reviewed_at=case when p_target_status='reviewed' then now_ts else reviewed_at end,approved_by=case when p_target_status='approved' then auth.uid() else approved_by end,approved_at=case when p_target_status='approved' then now_ts else approved_at end,locked_by=case when p_target_status='locked' then auth.uid() else locked_by end,locked_at=case when p_target_status='locked' then now_ts else locked_at end,updated_at=now_ts where id=p_calculation_id;
 return jsonb_build_object('id',p_calculation_id,'status',p_target_status);
end;$function$;
revoke all on function public.transition_tax_zakat_calculation(uuid,text) from public,anon;
grant execute on function public.transition_tax_zakat_calculation(uuid,text) to authenticated;

create or replace function public.list_tax_zakat_calculations(p_organization_id uuid,p_period_id uuid) returns jsonb language plpgsql security definer set search_path='' as $function$
declare out jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not (public.has_org_permission(p_organization_id,'screen.financial_statements.view') or public.has_org_permission(p_organization_id,'statements.view') or public.has_org_permission(p_organization_id,'view')) then raise exception 'Financial statements view permission required'; end if;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc),'[]'::jsonb) into out from public.tax_zakat_calculations c where c.organization_id=p_organization_id and c.period_id=p_period_id;
 return out;
end;$function$;
revoke all on function public.list_tax_zakat_calculations(uuid,uuid) from public,anon;
grant execute on function public.list_tax_zakat_calculations(uuid,uuid) to authenticated;