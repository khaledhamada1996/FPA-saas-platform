create or replace function public.get_budget_workspace(p_organization_id uuid,p_planning_version_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_version uuid; v_result jsonb;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not public.has_org_permission(p_organization_id,'budget.view') then raise exception 'Budget view permission required'; end if;
 if p_planning_version_id is not null then
  select id into v_version from public.planning_versions where id=p_planning_version_id and organization_id=p_organization_id and version_type='budget';
  if v_version is null then raise exception 'Budget version not found'; end if;
 else
  select id into v_version from public.planning_versions where organization_id=p_organization_id and version_type='budget' order by created_at desc limit 1;
 end if;
 select jsonb_build_object('version',(select to_jsonb(v) from public.planning_versions v where v.id=v_version),'periods',coalesce((select jsonb_agg(to_jsonb(p) order by p.period_start) from public.financial_periods p where p.organization_id=p_organization_id),'[]'::jsonb),'accounts',coalesce((select jsonb_agg(to_jsonb(a) order by a.code) from public.accounts a where a.organization_id=p_organization_id),'[]'::jsonb),'lines',coalesce((select jsonb_agg(to_jsonb(bl) order by bl.financial_period_id,bl.account_id) from public.budget_lines bl where bl.organization_id=p_organization_id and bl.planning_version_id=v_version),'[]'::jsonb)) into v_result;
 return v_result;
end; $$;
