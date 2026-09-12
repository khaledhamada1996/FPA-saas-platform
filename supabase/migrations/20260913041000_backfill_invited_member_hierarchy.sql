create or replace function public.accept_team_invite_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid:=auth.uid(); v_inv record; v_existing record; v_parent_level int; v_role_level int;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_inv from public.organization_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and status='pending' and expires_at>now() for update;
  if not found then raise exception 'INVITE_INVALID_OR_EXPIRED'; end if;
  select id, email into v_existing from auth.users where id=v_user;
  if lower(coalesce(v_existing.email,''))<>lower(v_inv.email) then raise exception 'INVITE_EMAIL_MISMATCH'; end if;
  select om.user_id,r.hierarchy_level into v_existing.user_id,v_parent_level from public.organization_members om join public.organization_roles r on r.organization_id=om.organization_id and r.role_key=om.role_key where om.organization_id=v_inv.organization_id and om.user_id=v_inv.invited_by;
  if v_existing.user_id is null then raise exception 'INVITER_NOT_MEMBER'; end if;
  if not public.has_org_permission(v_inv.organization_id,'manage_users') then raise exception 'INVITER_NO_LONGER_AUTHORIZED'; end if;
  select hierarchy_level into v_role_level from public.organization_roles where organization_id=v_inv.organization_id and role_key=v_inv.role_key;
  if v_role_level is null or v_role_level>v_parent_level then raise exception 'ROLE_LEVEL_FORBIDDEN'; end if;
  select * into v_existing from public.organization_members where organization_id=v_inv.organization_id and user_id=v_user;
  if found then raise exception 'ALREADY_MEMBER'; end if;
  insert into public.organization_members(organization_id,user_id,role,role_key,parent_user_id,permissions_initialized) values(v_inv.organization_id,v_user,case when v_inv.role_key='company_admin' then 'admin' when v_inv.role_key='fpa_analyst' then 'planner' else 'viewer' end,v_inv.role_key,v_inv.invited_by,false);
  update public.organization_invitations set status='accepted',invited_user_id=v_user,used_at=now(),updated_at=now() where id=v_inv.id;
  perform public.write_audit_event(v_inv.organization_id,'team_invite_accepted','organization_invitation',v_inv.id::text,null,jsonb_build_object('user_id',v_user,'parent_user_id',v_inv.invited_by,'role_key',v_inv.role_key));
  return jsonb_build_object('ok',true,'organization_id',v_inv.organization_id,'role_key',v_inv.role_key);
end;
$$;

update public.organization_members om
set parent_user_id=i.invited_by
from public.organization_invitations i
where om.organization_id=i.organization_id
  and om.user_id=i.invited_user_id
  and om.parent_user_id is null
  and i.status='accepted'
  and i.invited_user_id is not null
  and i.invited_by<>om.user_id;

revoke all on function public.accept_team_invite_link(text) from anon, public;
grant execute on function public.accept_team_invite_link(text) to authenticated;
