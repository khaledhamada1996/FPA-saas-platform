-- Backfill scoped planning permissions for existing initialized users only.
-- New invitees remain permissions_initialized=false and therefore have no access.
insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select m.organization_id,m.user_id,p.permission_key,true
from public.organization_members m
cross join lateral (select x.permission_key from (values
 ('budget.view'),('budget.create'),('budget.edit'),('budget.delete'),('budget.submit'),('budget.approve'),('budget.reject'),
 ('forecast.view'),('forecast.create'),('forecast.edit'),('forecast.delete'),('forecast.submit'),('forecast.approve'),('forecast.reject'),
 ('scenario.view'),('scenario.create'),('scenario.edit'),('scenario.delete'),('scenario.run')
) x(permission_key)) p
where m.permissions_initialized=true
  and (m.role_key in ('company_admin','executive_director') or (m.role_key='viewer' and p.permission_key in ('budget.view','forecast.view','scenario.view')))
on conflict(organization_id,user_id,permission_key) do update set granted=true;
