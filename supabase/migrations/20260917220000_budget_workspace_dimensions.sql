CREATE OR REPLACE FUNCTION public.get_budget_workspace(p_organization_id uuid, p_planning_version_id uuid DEFAULT NULL::uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
 select jsonb_build_object(
  'version',(select to_jsonb(v) from public.planning_versions v where v.id=v_version),
  'periods',coalesce((select jsonb_agg(to_jsonb(p) order by p.period_start) from public.financial_periods p where p.organization_id=p_organization_id),'[]'::jsonb),
  'accounts',coalesce((select jsonb_agg(to_jsonb(a) order by a.code) from public.accounts a where a.organization_id=p_organization_id),'[]'::jsonb),
  'legal_entities',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'code',e.code,'name',e.name) order by e.code,e.name) from public.legal_entities e where e.organization_id=p_organization_id),'[]'::jsonb),
  'branches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'code',b.code,'name',b.name) order by b.code,b.name) from public.branches b where b.organization_id=p_organization_id and b.is_active),'[]'::jsonb),
  'departments',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'code',d.code,'name',d.name) order by d.code,d.name) from public.departments d where d.organization_id=p_organization_id),'[]'::jsonb),
  'cost_centers',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name) order by c.code,c.name) from public.cost_centers c where c.organization_id=p_organization_id),'[]'::jsonb),
  'regions',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'name',r.name) order by r.code,r.name) from public.regions r where r.organization_id=p_organization_id),'[]'::jsonb),
  'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name) order by p.code,p.name) from public.products p where p.organization_id=p_organization_id),'[]'::jsonb),
  'projects',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name) order by p.code,p.name) from public.projects p where p.organization_id=p_organization_id),'[]'::jsonb),
  'lines',coalesce((select jsonb_agg(to_jsonb(bl) order by bl.financial_period_id,bl.account_id) from public.budget_lines bl where bl.organization_id=p_organization_id and bl.planning_version_id=v_version),'[]'::jsonb)
 ) into v_result;
 return v_result;
end; $$;
REVOKE ALL ON FUNCTION public.get_budget_workspace(uuid,uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_budget_workspace(uuid,uuid) TO authenticated;
