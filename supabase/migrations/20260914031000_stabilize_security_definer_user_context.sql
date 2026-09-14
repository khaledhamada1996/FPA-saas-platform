create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.organization_members
    where organization_id=target_organization_id
      and user_id=coalesce(nullif(current_setting('request.jwt.claim.sub',true),''), nullif((current_setting('request.jwt.claims',true)::jsonb ->> 'sub'),''))::uuid
      and coalesce(nullif(current_setting('request.jwt.claim.sub',true),''), nullif((current_setting('request.jwt.claims',true)::jsonb ->> 'sub'),'') ) is not null
  );
$$;

create or replace function public.has_org_permission(p_organization_id uuid,p_permission_key text)
returns boolean
language sql
security definer
set search_path=''
set row_security='off'
as $$
  select exists(
    select 1
    from public.organization_members om
    join public.organization_member_permission_overrides po
      on po.organization_id=om.organization_id
     and po.user_id=om.user_id
    where om.organization_id=p_organization_id
      and om.user_id=coalesce(nullif(current_setting('request.jwt.claim.sub',true),''), nullif((current_setting('request.jwt.claims',true)::jsonb ->> 'sub'),''))::uuid
      and coalesce(nullif(current_setting('request.jwt.claim.sub',true),''), nullif((current_setting('request.jwt.claims',true)::jsonb ->> 'sub'),'') ) is not null
      and om.permissions_initialized=true
      and po.permission_key=p_permission_key
      and po.granted=true
  );
$$;
