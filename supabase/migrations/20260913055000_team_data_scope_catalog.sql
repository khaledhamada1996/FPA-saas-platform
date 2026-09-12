create or replace function public.get_team_data_scope_catalog(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid(); v_result jsonb;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_permission(p_organization_id,'data_scope.view') then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor) then raise exception 'ORG_ACCESS_DENIED'; end if;
  select jsonb_build_object(
    'legal_entity',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'code',x.code) order by x.name) from public.legal_entities x where x.organization_id=p_organization_id and (not exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='legal_entity') or exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='legal_entity' and s.scope_id=x.id))),'[]'::jsonb),
    'branch',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'code',x.code) order by x.name) from public.branches x where x.organization_id=p_organization_id and coalesce(x.is_active,true) and (not exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='branch') or exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='branch' and s.scope_id=x.id))),'[]'::jsonb),
    'department',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'code',x.code) order by x.name) from public.departments x where x.organization_id=p_organization_id and (not exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='department') or exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='department' and s.scope_id=x.id))),'[]'::jsonb),
    'cost_center',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'code',x.code) order by x.name) from public.cost_centers x where x.organization_id=p_organization_id and (not exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='cost_center') or exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='cost_center' and s.scope_id=x.id))),'[]'::jsonb),
    'region',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'code',x.code) order by x.name) from public.regions x where x.organization_id=p_organization_id and (not exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='region') or exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='region' and s.scope_id=x.id))),'[]'::jsonb),
    'product',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'code',x.code) order by x.name) from public.products x where x.organization_id=p_organization_id and (not exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='product') or exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='product' and s.scope_id=x.id))),'[]'::jsonb),
    'project',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'code',x.code) order by x.name) from public.projects x where x.organization_id=p_organization_id and (not exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='project') or exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type='project' and s.scope_id=x.id))),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_team_data_scope_catalog(uuid) from public,anon;
grant execute on function public.get_team_data_scope_catalog(uuid) to authenticated;

create or replace function public.get_team_member_data_scopes(p_organization_id uuid,p_user_id uuid)
returns table(scope_type text,scope_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_permission(p_organization_id,'data_scope.view') then raise exception 'FORBIDDEN'; end if;
  if p_user_id <> v_actor and not public.can_manage_member(p_organization_id,p_user_id) then raise exception 'TARGET_OUTSIDE_SCOPE'; end if;
  return query select s.scope_type,s.scope_id from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=p_user_id order by s.scope_type,s.scope_id;
end;
$$;
revoke all on function public.get_team_member_data_scopes(uuid,uuid) from public,anon;
grant execute on function public.get_team_member_data_scopes(uuid,uuid) to authenticated;