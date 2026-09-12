insert into public.organization_permissions(permission_key,name,description,permission_type,category,sort_order) values ('data_scope.view','عرض نطاق البيانات','عرض نطاق البيانات المسموح بها للمستخدم','action','Administration',900),('data_scope.manage','إدارة نطاق البيانات','تحديد الأبعاد والكيانات المتاحة للمستخدم','action','Administration',901) on conflict(permission_key) do update set name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,category=excluded.category,sort_order=excluded.sort_order;

insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select om.organization_id,om.user_id,p.permission_key,true
from public.organization_members om
join public.organization_roles r on r.organization_id=om.organization_id and r.role_key=om.role_key
cross join public.organization_permissions p
where om.permissions_initialized=true and r.hierarchy_level>=90 and p.permission_key in ('data_scope.view','data_scope.manage')
on conflict (organization_id,user_id,permission_key) do update set granted=true;

create or replace function public.set_team_member_data_scope(p_organization_id uuid,p_user_id uuid,p_scope_type text,p_scope_id uuid,p_granted boolean default true)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_scope_type text:=lower(btrim(p_scope_type)); v_exists boolean; v_actor_restricted boolean;
begin
 if v_actor is null then raise exception 'Authentication required'; end if;
 if p_organization_id is null or p_user_id is null then raise exception 'Organization and user are required'; end if;
 if v_actor=p_user_id then raise exception 'SELF_SCOPE_CHANGE_FORBIDDEN'; end if;
 if not public.has_org_permission(p_organization_id,'data_scope.manage') then raise exception 'DATA_SCOPE_MANAGE_REQUIRED'; end if;
 if not public.can_manage_member(p_organization_id,p_user_id) then raise exception 'TARGET_OUTSIDE_MANAGEMENT_SCOPE'; end if;
 if v_scope_type not in ('legal_entity','branch','department','cost_center','region','product','project') then raise exception 'INVALID_SCOPE_TYPE'; end if;
 if p_scope_id is null then raise exception 'SCOPE_ID_REQUIRED'; end if;
 if v_scope_type='legal_entity' then select exists(select 1 from public.legal_entities where id=p_scope_id and organization_id=p_organization_id) into v_exists;
 elsif v_scope_type='branch' then select exists(select 1 from public.company_branches where id=p_scope_id and organization_id=p_organization_id) into v_exists;
 elsif v_scope_type='department' then select exists(select 1 from public.departments where id=p_scope_id and organization_id=p_organization_id) into v_exists;
 elsif v_scope_type='cost_center' then select exists(select 1 from public.cost_centers where id=p_scope_id and organization_id=p_organization_id) into v_exists;
 elsif v_scope_type='region' then select exists(select 1 from public.regions where id=p_scope_id and organization_id=p_organization_id) into v_exists;
 elsif v_scope_type='product' then select exists(select 1 from public.products where id=p_scope_id and organization_id=p_organization_id) into v_exists;
 else select exists(select 1 from public.projects where id=p_scope_id and organization_id=p_organization_id) into v_exists; end if;
 if not v_exists then raise exception 'INVALID_SCOPE_TARGET'; end if;
 select exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type=v_scope_type) into v_actor_restricted;
 if v_actor_restricted and not exists(select 1 from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=v_actor and s.scope_type=v_scope_type and s.scope_id=p_scope_id) then raise exception 'SCOPE_EXCEEDS_YOUR_ACCESS'; end if;
 if p_granted then insert into public.organization_member_scopes(organization_id,user_id,scope_type,scope_id) values(p_organization_id,p_user_id,v_scope_type,p_scope_id) on conflict(organization_id,user_id,scope_type,scope_id) do nothing;
 else delete from public.organization_member_scopes where organization_id=p_organization_id and user_id=p_user_id and scope_type=v_scope_type and scope_id=p_scope_id; end if;
 perform public.write_audit_event(p_organization_id,case when p_granted then 'team.scope.grant' else 'team.scope.revoke' end,'organization_member',p_user_id::text,null,jsonb_build_object('scope_type',v_scope_type,'scope_id',p_scope_id));
end; $$;

create or replace function public.get_team_member_data_scopes(p_organization_id uuid,p_user_id uuid)
returns table(scope_type text,scope_id uuid) language sql stable security definer set search_path='' as $$
 select s.scope_type,s.scope_id from public.organization_member_scopes s where s.organization_id=p_organization_id and s.user_id=p_user_id and public.has_org_permission(p_organization_id,'data_scope.view') and (p_user_id=auth.uid() or public.can_manage_member(p_organization_id,p_user_id));
$$;

revoke execute on function public.set_team_member_data_scope(uuid,uuid,text,uuid,boolean),public.get_team_member_data_scopes(uuid,uuid),public.has_org_data_scope(uuid,text,uuid) from anon,public;
grant execute on function public.set_team_member_data_scope(uuid,uuid,text,uuid,boolean),public.get_team_member_data_scopes(uuid,uuid),public.has_org_data_scope(uuid,text,uuid) to authenticated;
