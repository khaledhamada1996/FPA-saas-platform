insert into public.organization_member_permission_overrides (organization_id,user_id,permission_key,granted)
select m.organization_id,m.user_id,p.permission_key,true
from public.organization_members m
join public.organization_permissions p
  on p.permission_key in ('account_import.view','account_import.create','account_import.validate','account_import.apply')
where m.role_key in ('company_admin','executive_director','board')
  and m.permissions_initialized=true
on conflict (organization_id,user_id,permission_key)
do update set granted=excluded.granted;

revoke execute on function public.create_account_import_batch(uuid,text,text,jsonb) from anon, public;
grant execute on function public.create_account_import_batch(uuid,text,text,jsonb) to authenticated;
