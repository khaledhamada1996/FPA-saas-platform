-- P0/P1 authorization hardening: planning reads and period creation use explicit permissions.
create or replace function public.get_planning_workspace(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_result jsonb;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not public.has_org_permission(p_organization_id,'view') then raise exception 'Not authorized'; end if;
 select jsonb_build_object(
   'versions', coalesce((select jsonb_agg(jsonb_build_object('version',to_jsonb(v),'steps',coalesce((select jsonb_agg(to_jsonb(s) order by s.step_order) from public.planning_version_approval_steps s where s.planning_version_id=v.id),'[]'::jsonb)) order by v.created_at desc) from public.planning_versions v where v.organization_id=p_organization_id),'[]'::jsonb),
   'notifications', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from public.notifications n where n.organization_id=p_organization_id and n.recipient_user_id=v_user and n.read_at is null),'[]'::jsonb)
 ) into v_result;
 return v_result;
end; $$;

create or replace function public.get_planning_approval_policy(p_organization_id uuid)
returns table(policy_code text,step_order integer,step_name text,required_role_key text,allow_submitter boolean)
language sql security definer set search_path = '' as $$
 select p.policy_code,s.step_order,s.step_name,s.required_role_key,s.allow_submitter
 from public.planning_approval_policies p join public.planning_approval_steps s on s.policy_id=p.id
 where p.organization_id=p_organization_id and p.is_active and public.has_org_permission(p_organization_id,'view') order by s.step_order
$$;

create or replace function public.create_monthly_financial_periods(target_organization_id uuid,fiscal_year integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare start_month smallint; fy_start date; inserted_count integer := 0;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not public.has_org_permission(target_organization_id,'manage_settings') then raise exception 'Not authorized'; end if;
 if fiscal_year < 2000 or fiscal_year > 2100 then raise exception 'Fiscal year out of supported range'; end if;
 select fiscal_year_start_month into start_month from public.organizations where id=target_organization_id;
 if start_month is null then raise exception 'organization not found'; end if;
 fy_start := make_date(fiscal_year,start_month,1);
 insert into public.financial_periods(organization_id,period_start,period_end,status)
 select target_organization_id,(fy_start+make_interval(months=>gs))::date,(fy_start+make_interval(months=>gs+1)-interval '1 day')::date,'open'
 from generate_series(0,11) gs on conflict (organization_id,period_start) do nothing;
 get diagnostics inserted_count=row_count; return inserted_count;
end; $$;

create or replace function public.is_org_admin(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.organization_members where organization_id=target_organization_id and user_id=auth.uid() and coalesce(role_key,case role when 'admin' then 'company_admin' when 'owner' then 'company_admin' else 'viewer' end)='company_admin');
$$;

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.organization_members where organization_id=target_organization_id and user_id=auth.uid());
$$;
