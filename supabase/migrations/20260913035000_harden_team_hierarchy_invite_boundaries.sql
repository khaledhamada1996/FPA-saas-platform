create or replace function public.create_team_invite_link(p_organization_id uuid, p_email text, p_role_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_token text;
  v_hash text;
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
  v_email text := lower(trim(p_email));
  v_actor_level int;
  v_role_level int;
  v_existing_user uuid;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.has_org_permission(p_organization_id,'manage_users') then raise exception 'FORBIDDEN'; end if;

  select coalesce(r.hierarchy_level,0) into v_actor_level
  from public.organization_members om
  left join public.organization_roles r
    on r.organization_id=om.organization_id
   and r.role_key=coalesce(om.role_key,'viewer')
  where om.organization_id=p_organization_id and om.user_id=v_user;

  select coalesce(max(hierarchy_level),-1) into v_role_level
  from public.organization_roles
  where organization_id=p_organization_id and role_key=p_role_key;

  if v_role_level < 0 then raise exception 'INVALID_ROLE'; end if;
  if v_role_level > v_actor_level then raise exception 'ROLE_LEVEL_FORBIDDEN'; end if;
  if v_email='' or position('@' in v_email)=0 then raise exception 'INVALID_EMAIL'; end if;

  select u.id into v_existing_user
  from auth.users u
  where lower(u.email)=v_email
  limit 1;

  if v_existing_user is not null and exists (
    select 1 from public.organization_members om
    where om.organization_id=p_organization_id and om.user_id=v_existing_user
  ) then
    raise exception 'USER_ALREADY_MEMBER';
  end if;

  update public.organization_invitations
     set status='revoked', updated_at=now()
   where organization_id=p_organization_id
     and lower(email)=v_email
     and status='pending';

  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  v_hash:=encode(extensions.digest(v_token,'sha256'),'hex');

  insert into public.organization_invitations(
    organization_id,email,role_key,invited_by,status,expires_at,token_hash
  ) values (
    p_organization_id,v_email,p_role_key,v_user,'pending',v_expires,v_hash
  ) returning id into v_id;

  perform public.write_audit_event(
    p_organization_id,
    'team_invite_link_created',
    'organization_invitation',
    v_id::text,
    null,
    jsonb_build_object('invitation_id',v_id,'email',v_email,'role_key',p_role_key,'parent_user_id',v_user)
  );

  return jsonb_build_object('ok',true,'token',v_token,'expires_at',v_expires,'invitation_id',v_id);
end;
$$;

create or replace function public.accept_team_invite_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_inv public.organization_invitations%rowtype;
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_inviter_level int;
  v_role_level int;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_inv
  from public.organization_invitations
  where token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex')
    and status='pending'
    and expires_at>now()
  for update;

  if not found then raise exception 'INVITE_EXPIRED_OR_INVALID'; end if;
  if v_email<>lower(v_inv.email) then raise exception 'INVITE_EMAIL_MISMATCH'; end if;

  if exists (
    select 1 from public.organization_members om
    where om.organization_id=v_inv.organization_id and om.user_id=v_user
  ) then
    raise exception 'USER_ALREADY_MEMBER';
  end if;

  select coalesce(r.hierarchy_level,0) into v_inviter_level
  from public.organization_members om
  left join public.organization_roles r
    on r.organization_id=om.organization_id
   and r.role_key=coalesce(om.role_key,'viewer')
  where om.organization_id=v_inv.organization_id and om.user_id=v_inv.invited_by;

  if v_inviter_level is null then raise exception 'INVITER_NO_LONGER_MEMBER'; end if;
  if not public.has_org_permission(v_inv.organization_id,'manage_users') then
    raise exception 'INVITER_NO_LONGER_AUTHORIZED';
  end if;

  select max(hierarchy_level) into v_role_level
  from public.organization_roles
  where organization_id=v_inv.organization_id and role_key=v_inv.role_key;

  if v_role_level is null or v_role_level>v_inviter_level then
    raise exception 'ROLE_LEVEL_FORBIDDEN';
  end if;

  insert into public.organization_members(
    organization_id,user_id,role,role_key,parent_user_id,permissions_initialized
  ) values(
    v_inv.organization_id,v_user,v_inv.role_key,v_inv.role_key,v_inv.invited_by,false
  );

  delete from public.organization_member_permission_overrides
  where organization_id=v_inv.organization_id and user_id=v_user;

  update public.organization_invitations
     set status='accepted',invited_user_id=v_user,used_at=now(),updated_at=now()
   where id=v_inv.id;

  perform public.write_audit_event(
    v_inv.organization_id,
    'team_invite_link_accepted',
    'organization_invitation',
    v_inv.id::text,
    null,
    jsonb_build_object('invitation_id',v_inv.id,'user_id',v_user,'parent_user_id',v_inv.invited_by)
  );

  return jsonb_build_object('ok',true,'organization_id',v_inv.organization_id,'role_key',v_inv.role_key,'permissions_initialized',false);
end;
$$;

revoke all on function public.create_team_invite_link(uuid,text,text) from anon, public;
grant execute on function public.create_team_invite_link(uuid,text,text) to authenticated;
revoke all on function public.accept_team_invite_link(text) from anon, public;
grant execute on function public.accept_team_invite_link(text) to authenticated;
