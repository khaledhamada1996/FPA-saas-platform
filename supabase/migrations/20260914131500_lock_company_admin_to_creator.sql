-- Only the original creator of a company may be company_admin.
create or replace function public.create_team_invite_link(p_organization_id uuid,p_email text,p_role_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_token text; v_hash text; v_id uuid; v_expires timestamptz:=now()+interval '7 days'; v_email text:=lower(trim(p_email)); v_actor_level int; v_role_level int; v_existing_user uuid;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.has_org_permission(p_organization_id,'manage_users') then raise exception 'FORBIDDEN'; end if;
  if p_role_key='company_admin' then raise exception 'SYSTEM_ADMIN_ROLE_CANNOT_BE_ASSIGNED'; end if;
  select coalesce(r.hierarchy_level,0) into v_actor_level from public.organization_members om left join public.organization_roles r on r.organization_id=om.organization_id and r.role_key=coalesce(om.role_key,'viewer') where om.organization_id=p_organization_id and om.user_id=v_user;
  select coalesce(max(hierarchy_level),-1) into v_role_level from public.organization_roles where organization_id=p_organization_id and role_key=p_role_key;
  if v_role_level<0 then raise exception 'INVALID_ROLE'; end if;
  if v_role_level>v_actor_level then raise exception 'ROLE_LEVEL_FORBIDDEN'; end if;
  if v_email='' or position('@' in v_email)=0 then raise exception 'INVALID_EMAIL'; end if;
  select u.id into v_existing_user from auth.users u where lower(u.email)=v_email limit 1;
  if v_existing_user is not null and exists(select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=v_existing_user) then raise exception 'USER_ALREADY_MEMBER'; end if;
  update public.organization_invitations set status='revoked',updated_at=now() where organization_id=p_organization_id and lower(email)=v_email and status='pending';
  v_token:=encode(extensions.gen_random_bytes(32),'hex'); v_hash:=encode(extensions.digest(v_token,'sha256'),'hex');
  insert into public.organization_invitations(organization_id,email,role_key,invited_by,status,expires_at,token_hash) values(p_organization_id,v_email,p_role_key,v_user,'pending',v_expires,v_hash) returning id into v_id;
  perform public.write_audit_event(p_organization_id,'team_invite_link_created','organization_invitation',v_id::text,null,jsonb_build_object('invitation_id',v_id,'email',v_email,'role_key',p_role_key,'parent_user_id',v_user));
  return jsonb_build_object('ok',true,'token',v_token,'expires_at',v_expires,'invitation_id',v_id);
end;
$$;
revoke all on function public.create_team_invite_link(uuid,text,text) from public;
grant execute on function public.create_team_invite_link(uuid,text,text) to authenticated;

create or replace function public.set_team_member_role(p_organization_id uuid,p_user_id uuid,p_role_key text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_actor_level int; v_target_level int; v_before jsonb;
begin
  if v_user is null or not public.has_org_permission(p_organization_id,'manage_users') then raise exception 'User management permission required'; end if;
  if p_role_key='company_admin' then raise exception 'SYSTEM_ADMIN_ROLE_CANNOT_BE_ASSIGNED'; end if;
  if not public.can_manage_member(p_organization_id,p_user_id) then raise exception 'MEMBER_OUTSIDE_YOUR_HIERARCHY'; end if;
  select coalesce(r.hierarchy_level,0) into v_actor_level from public.organization_members om left join public.organization_roles r on r.organization_id=om.organization_id and r.role_key=coalesce(om.role_key,'viewer') where om.organization_id=p_organization_id and om.user_id=v_user;
  select max(hierarchy_level) into v_target_level from public.organization_roles where organization_id=p_organization_id and role_key=p_role_key;
  if v_target_level is null then raise exception 'Role not found'; end if;
  if v_target_level>v_actor_level then raise exception 'ROLE_LEVEL_FORBIDDEN'; end if;
  select jsonb_build_object('role',role,'role_key',role_key) into v_before from public.organization_members where organization_id=p_organization_id and user_id=p_user_id;
  update public.organization_members set role=case when p_role_key='fpa_analyst' then 'planner' else 'viewer' end,role_key=p_role_key where organization_id=p_organization_id and user_id=p_user_id;
  perform public.write_audit_event(p_organization_id,'team_member_role_changed','organization_member',p_user_id::text,v_before,jsonb_build_object('role_key',p_role_key)); return true;
end;
$$;
revoke all on function public.set_team_member_role(uuid,uuid,text) from public;
grant execute on function public.set_team_member_role(uuid,uuid,text) to authenticated;

with ranked as (select organization_id,user_id,row_number() over(partition by organization_id order by created_at asc,user_id) as rn from public.organization_members where role_key='company_admin')
update public.organization_members om set role='viewer',role_key='viewer',permissions_initialized=false where om.role_key='company_admin' and exists(select 1 from ranked r where r.organization_id=om.organization_id and r.user_id=om.user_id and r.rn>1);

delete from public.organization_member_permission_overrides po where exists(select 1 from public.organization_members om where om.organization_id=po.organization_id and om.user_id=po.user_id and om.role_key='viewer');
