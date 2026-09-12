-- Ensure the documented Finance -> CEO -> Board workflow has a real Board role.
create or replace function public.bootstrap_board_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.organization_roles(organization_id,role_key,name,description,is_system)
 values(new.id,'board','مجلس الإدارة','الاعتماد النهائي والرقابة التنفيذية',true)
 on conflict (organization_id,role_key) do nothing;
 insert into public.organization_role_permissions(organization_id,role_key,permission_key)
 select new.id,'board',p.permission_key from public.organization_permissions p
 where p.permission_key in ('view','export','approve','access_ai') on conflict do nothing;
 return new;
end; $$;

drop trigger if exists organizations_bootstrap_board_role on public.organizations;
create trigger organizations_bootstrap_board_role after insert on public.organizations
for each row execute function public.bootstrap_board_role();

insert into public.organization_roles(organization_id,role_key,name,description,is_system)
select id,'board','مجلس الإدارة','الاعتماد النهائي والرقابة التنفيذية',true from public.organizations
on conflict (organization_id,role_key) do nothing;

insert into public.organization_role_permissions(organization_id,role_key,permission_key)
select o.id,'board',p.permission_key from public.organizations o cross join public.organization_permissions p
where p.permission_key in ('view','export','approve','access_ai') on conflict do nothing;

create or replace function public.delete_workspace(p_organization_id uuid,p_confirmation_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not public.has_org_permission(p_organization_id,'manage_settings') then raise exception 'Only a company administrator can delete this company'; end if;
 select name into v_name from public.organizations where id=p_organization_id;
 if v_name is null then raise exception 'Company not found'; end if;
 if trim(coalesce(p_confirmation_name,'')) <> v_name then raise exception 'Confirmation name does not match the company name'; end if;
 delete from public.organizations where id=p_organization_id; return true;
end; $$;
