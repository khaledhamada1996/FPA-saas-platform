create or replace function public.get_company_onboarding_status(p_organization_id uuid)
returns table(organization_id uuid, company_name text, initial_data_source text, completed boolean, next_route text)
language plpgsql
stable security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_source text; v_name text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.organization_members om where om.organization_id = p_organization_id and om.user_id = v_user) then raise exception 'Organization access denied'; end if;
  select o.name, o.initial_data_source into v_name, v_source from public.organizations o where o.id = p_organization_id;
  if v_name is null then raise exception 'Organization not found'; end if;
  organization_id := p_organization_id;
  company_name := v_name;
  initial_data_source := v_source;
  completed := coalesce(v_source in ('excel','manual','integration'), false);
  next_route := case v_source when 'excel' then '/workspace/data' when 'integration' then '/workspace/data-monitoring/connectors' when 'manual' then '/workspace/data/accounts' else '/onboarding' end;
  return next;
end;
$$;

create or replace function public.complete_company_onboarding(p_organization_id uuid, p_initial_data_source text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_source text := lower(trim(p_initial_data_source));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_source not in ('excel','manual','integration') then raise exception 'Initial data source is invalid'; end if;
  if not public.has_org_permission(p_organization_id,'manage_settings') then raise exception 'Settings permission required'; end if;
  update public.organizations set initial_data_source=v_source, updated_at=now() where id=p_organization_id;
  if not found then raise exception 'Organization not found'; end if;
  perform public.write_audit_event(p_organization_id,'company_onboarding_completed','organization',p_organization_id::text,null,jsonb_build_object('initial_data_source',v_source));
  return case v_source when 'excel' then '/workspace/data' when 'integration' then '/workspace/data-monitoring/connectors' else '/workspace/data/accounts' end;
end;
$$;

revoke all on function public.get_company_onboarding_status(uuid) from public, anon;
grant execute on function public.get_company_onboarding_status(uuid) to authenticated;
revoke all on function public.complete_company_onboarding(uuid,text) from public, anon;
grant execute on function public.complete_company_onboarding(uuid,text) to authenticated;
