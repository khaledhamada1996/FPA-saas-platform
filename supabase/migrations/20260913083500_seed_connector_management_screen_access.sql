insert into public.organization_permissions(permission_key,name,description,permission_type,screen_key,route_path,category,sort_order)
values ('screen.connector_management.view','عرض إدارة الموصلات','الوصول إلى شاشة إدارة موصلات البيانات','screen','screen.connector_management.view','/workspace/data-monitoring/connectors','data',36)
on conflict (permission_key) do update set
  name=excluded.name,
  description=excluded.description,
  permission_type=excluded.permission_type,
  screen_key=excluded.screen_key,
  route_path=excluded.route_path,
  category=excluded.category,
  sort_order=excluded.sort_order;

insert into public.organization_role_permissions(organization_id,role_key,permission_key)
select o.id,r.role_key,'screen.connector_management.view'
from public.organizations o cross join public.organization_roles r
where r.hierarchy_level >= 90
on conflict do nothing;

insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select distinct m.organization_id,m.user_id,'screen.connector_management.view',true
from public.organization_members m
join public.organization_roles r on r.role_key=m.role_key
where m.permissions_initialized=true and r.hierarchy_level>=90
on conflict (organization_id,user_id,permission_key) do update set granted=true;
