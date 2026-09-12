create or replace function public.get_my_organizations()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'legal_name',o.legal_name,'base_currency',o.base_currency,'country',o.country,'industry',o.industry,'role',om.role_key) order by o.name),'[]'::jsonb) into v_result
 from public.organization_members om join public.organizations o on o.id=om.organization_id where om.user_id=v_user;
 return v_result;
end; $$;
revoke all on function public.get_my_organizations() from public,anon;
grant execute on function public.get_my_organizations() to authenticated;

create or replace function public.get_organization_context(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_organization_id is null or not public.has_org_permission(p_organization_id,'view') then raise exception 'Not authorized'; end if;
 select jsonb_build_object('organization',jsonb_build_object('id',o.id,'name',o.name,'legal_name',o.legal_name,'base_currency',o.base_currency,'country',o.country,'industry',o.industry,'company_size',o.company_size),'role',om.role_key,'legal_entities',coalesce((select jsonb_agg(jsonb_build_object('id',le.id,'name',le.name,'code',le.code,'currency',le.currency) order by le.name) from public.legal_entities le where le.organization_id=o.id),'[]'::jsonb)) into v_result
 from public.organizations o join public.organization_members om on om.organization_id=o.id and om.user_id=v_user where o.id=p_organization_id;
 if v_result is null then raise exception 'Organization not found'; end if;
 return v_result;
end; $$;
revoke all on function public.get_organization_context(uuid) from public,anon;
grant execute on function public.get_organization_context(uuid) to authenticated;
