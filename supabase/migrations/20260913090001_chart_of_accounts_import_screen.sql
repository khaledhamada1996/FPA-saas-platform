begin;
insert into public.organization_permissions(permission_key,permission_name,permission_type,screen_key,route_path,category,sort_order)
values('screen.chart_of_accounts_import.view','عرض شاشة استيراد دليل الحسابات','screen','screen.chart_of_accounts_import.view','/workspace/data/chart-of-accounts','data',37)
on conflict(permission_key) do update set permission_name=excluded.permission_name,permission_type=excluded.permission_type,screen_key=excluded.screen_key,route_path=excluded.route_path,category=excluded.category,sort_order=excluded.sort_order;
insert into public.organization_role_permissions(role_key,permission_key)
select role_key,'screen.chart_of_accounts_import.view' from public.organization_roles where hierarchy_level>=90
on conflict do nothing;
commit;