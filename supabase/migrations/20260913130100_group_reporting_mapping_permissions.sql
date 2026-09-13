insert into public.organization_permissions(permission_key,name,description,permission_type,screen_key,route_path,category,sort_order)
values ('screen.group_mapping.view','ربط حسابات المجموعة','عرض شاشة ربط حسابات الشركات بالتقارير الموحدة','screen','screen.group_mapping.view','/workspace/group-reporting/mapping','group',912)
on conflict (permission_key) do update set name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,screen_key=excluded.screen_key,route_path=excluded.route_path,category=excluded.category,sort_order=excluded.sort_order;
insert into public.organization_role_permissions(organization_id,role_key,permission_key)
select om.organization_id,om.role_key,'screen.group_mapping.view' from public.organization_members om where om.role_key in ('company_admin','executive_director','board') on conflict do nothing;
update public.organization_member_permission_overrides o set granted=true where o.permission_key='screen.group_mapping.view' and o.granted=true;
revoke all on function public.get_group_reporting_accounts(uuid) from public,anon;
revoke all on function public.upsert_group_reporting_account(uuid,text,text,text,text,integer) from public,anon;
revoke all on function public.upsert_group_account_mapping(uuid,uuid,uuid,uuid) from public,anon;
revoke all on function public.get_group_account_mapping(uuid) from public,anon;
grant execute on function public.get_group_reporting_accounts(uuid) to authenticated;
grant execute on function public.upsert_group_reporting_account(uuid,text,text,text,text,integer) to authenticated;
grant execute on function public.upsert_group_account_mapping(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.get_group_account_mapping(uuid) to authenticated;
