insert into public.organization_permissions(permission_key,name,description,permission_type,screen_key,route_path,category,sort_order)
values ('data_monitoring.view','عرض مراقبة مصادر البيانات','الوصول إلى شاشة مراقبة مصادر البيانات','screen','screen.data_monitoring.view','/workspace/data-monitoring','data',35)
on conflict (permission_key) do update set
 name=excluded.name,
 description=excluded.description,
 permission_type=excluded.permission_type,
 screen_key=excluded.screen_key,
 route_path=excluded.route_path,
 category=excluded.category,
 sort_order=excluded.sort_order;
