-- Production hardening applied to the canonical security boundary.
-- Remove non-application table privileges from API roles.
revoke references, trigger, truncate on all tables in schema public from anon, authenticated;

create or replace function public.has_org_data_scope(p_organization_id uuid, p_scope_type text, p_scope_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.organization_members om where om.organization_id = p_organization_id and om.user_id = auth.uid())
    and (not exists (select 1 from public.organization_member_scopes s where s.organization_id = p_organization_id and s.user_id = auth.uid())
      or (p_scope_id is null
        or not exists (select 1 from public.organization_member_scopes s where s.organization_id = p_organization_id and s.user_id = auth.uid() and s.scope_type = p_scope_type)
        or exists (select 1 from public.organization_member_scopes s where s.organization_id = p_organization_id and s.user_id = auth.uid() and s.scope_type = p_scope_type and s.scope_id = p_scope_id)));
$$;
revoke all on function public.has_org_data_scope(uuid,text,uuid) from public, anon;
grant execute on function public.has_org_data_scope(uuid,text,uuid) to authenticated;

create or replace function public.write_audit_event(p_organization_id uuid, p_action text, p_target_type text, p_target_id text, p_before_values jsonb, p_after_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.organization_members om where om.organization_id = p_organization_id and om.user_id = auth.uid()) then raise exception 'Not authorized'; end if;
  insert into public.audit_events(organization_id,actor_user_id,action,target_type,target_id,request_id,before_values,after_values)
  values (p_organization_id,auth.uid(),p_action,p_target_type,p_target_id,null,p_before_values,p_after_values) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.write_audit_event(uuid,text,text,text,jsonb,jsonb) from public, anon;
grant execute on function public.write_audit_event(uuid,text,text,text,jsonb,jsonb) to authenticated;

create or replace function public.audit_material_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_target text; v_action text; v_before jsonb; v_after jsonb;
begin
  v_org := coalesce((to_jsonb(new)->>'organization_id')::uuid,(to_jsonb(old)->>'organization_id')::uuid);
  v_target := coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id');
  v_action := lower(tg_op);
  v_before := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_after := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  insert into public.audit_events(organization_id,actor_user_id,action,target_type,target_id,request_id,before_values,after_values)
  values(v_org,auth.uid(),v_action,tg_table_name,v_target,null,v_before,v_after);
  return coalesce(new,old);
end;
$$;
revoke all on function public.audit_material_mutation() from public, anon, authenticated;
