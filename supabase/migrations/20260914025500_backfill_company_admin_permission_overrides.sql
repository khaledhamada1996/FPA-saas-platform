insert into public.organization_member_permission_overrides (organization_id,user_id,permission_key,granted)
select om.organization_id, om.user_id, op.permission_key, true
from public.organization_members om
cross join public.organization_permissions op
where om.role_key='company_admin'
  and om.permissions_initialized=true
on conflict (organization_id,user_id,permission_key)
  do update set granted=true;
