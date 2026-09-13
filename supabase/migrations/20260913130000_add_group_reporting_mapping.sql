-- Group reporting foundation: company-specific COAs remain isolated while authorized users
-- can map each company's accounts into a shared group reporting structure.

create table if not exists public.group_reporting_accounts (
  id uuid primary key default gen_random_uuid(),
  root_organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  statement_type text,
  statement_section text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(root_organization_id, code)
);

create table if not exists public.group_account_mappings (
  id uuid primary key default gen_random_uuid(),
  root_organization_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  group_reporting_account_id uuid not null references public.group_reporting_accounts(id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(root_organization_id, organization_id, account_id)
);

alter table public.group_reporting_accounts enable row level security;
alter table public.group_account_mappings enable row level security;
drop policy if exists group_reporting_accounts_deny_direct on public.group_reporting_accounts;
create policy group_reporting_accounts_deny_direct on public.group_reporting_accounts for all to authenticated using (false) with check (false);
drop policy if exists group_account_mappings_deny_direct on public.group_account_mappings;
create policy group_account_mappings_deny_direct on public.group_account_mappings for all to authenticated using (false) with check (false);
revoke all on public.group_reporting_accounts from anon, authenticated;
revoke all on public.group_account_mappings from anon, authenticated;

insert into public.organization_permissions(permission_key,name,description,permission_type,category,sort_order)
values
('group_mapping.view','عرض ربط المجموعة','عرض ربط حسابات الشركات بحسابات التقارير الموحدة','write','group',910),
('group_mapping.manage','إدارة ربط المجموعة','إنشاء وتعديل ربط حسابات الشركات بالتقارير الموحدة','write','group',911)
on conflict (permission_key) do update set name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,category=excluded.category,sort_order=excluded.sort_order;

insert into public.organization_role_permissions(organization_id,role_key,permission_key)
select om.organization_id, om.role_key, p.permission_key
from public.organization_members om
join public.organization_permissions p on p.permission_key in ('group_mapping.view','group_mapping.manage')
where om.role_key in ('company_admin','executive_director','board')
on conflict do nothing;

create or replace function public.get_group_reporting_accounts(p_root_organization_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid := (select auth.uid());
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_root_organization_id,'group.view') then raise exception 'FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order,x.code) from public.group_reporting_accounts x where x.root_organization_id=p_root_organization_id and x.is_active),'[]'::jsonb);
end $$;

create or replace function public.upsert_group_reporting_account(
 p_root_organization_id uuid,
 p_code text,
 p_name text,
 p_statement_type text default null,
 p_statement_section text default null,
 p_sort_order integer default 0
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_uid uuid := (select auth.uid());
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_root_organization_id,'group_mapping.manage') then raise exception 'FORBIDDEN'; end if;
 if not exists(select 1 from public.organizations where id=p_root_organization_id) then raise exception 'GROUP_NOT_FOUND'; end if;
 insert into public.group_reporting_accounts(root_organization_id,code,name,statement_type,statement_section,sort_order,created_by,updated_at)
 values(p_root_organization_id,trim(p_code),trim(p_name),p_statement_type,p_statement_section,coalesce(p_sort_order,0),v_uid,now())
 on conflict(root_organization_id,code) do update set name=excluded.name,statement_type=excluded.statement_type,statement_section=excluded.statement_section,sort_order=excluded.sort_order,is_active=true,updated_at=now()
 returning id into v_id;
 perform public.write_audit_event(p_root_organization_id,'group_reporting_account.upsert','group_reporting_account',v_id::text,null,jsonb_build_object('code',p_code,'name',p_name));
 return v_id;
end $$;

create or replace function public.upsert_group_account_mapping(
 p_root_organization_id uuid,
 p_organization_id uuid,
 p_account_id uuid,
 p_group_reporting_account_id uuid
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_uid uuid := (select auth.uid());
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_root_organization_id,'group_mapping.manage') then raise exception 'FORBIDDEN'; end if;
 if not exists(select 1 from public.organizations where id=p_organization_id and (id=p_root_organization_id or parent_organization_id is not null)) then raise exception 'ORGANIZATION_NOT_IN_GROUP'; end if;
 if not exists(select 1 from public.accounts where id=p_account_id and organization_id=p_organization_id) then raise exception 'ACCOUNT_NOT_FOUND'; end if;
 if not exists(select 1 from public.group_reporting_accounts where id=p_group_reporting_account_id and root_organization_id=p_root_organization_id) then raise exception 'GROUP_ACCOUNT_NOT_FOUND'; end if;
 insert into public.group_account_mappings(root_organization_id,organization_id,account_id,group_reporting_account_id,created_by,updated_at)
 values(p_root_organization_id,p_organization_id,p_account_id,p_group_reporting_account_id,v_uid,now())
 on conflict(root_organization_id,organization_id,account_id) do update set group_reporting_account_id=excluded.group_reporting_account_id,updated_at=now()
 returning id into v_id;
 perform public.write_audit_event(p_root_organization_id,'group_account_mapping.upsert','account',p_account_id::text,null,jsonb_build_object('group_reporting_account_id',p_group_reporting_account_id,'organization_id',p_organization_id));
 return v_id;
end $$;

create or replace function public.get_group_account_mapping(p_root_organization_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid := (select auth.uid());
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_root_organization_id,'group_mapping.view') then raise exception 'FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'organization_id',m.organization_id,'organization_name',o.name,'account_id',m.account_id,'account_code',a.code,'account_name',a.name,'group_reporting_account_id',g.id,'group_code',g.code,'group_name',g.name) order by o.name,a.code) from public.group_account_mappings m join public.organizations o on o.id=m.organization_id join public.accounts a on a.id=m.account_id join public.group_reporting_accounts g on g.id=m.group_reporting_account_id where m.root_organization_id=p_root_organization_id),'[]'::jsonb);
end $$;

revoke all on function public.get_group_reporting_accounts(uuid) from public,anon;
revoke all on function public.upsert_group_reporting_account(uuid,text,text,text,text,integer) from public,anon;
revoke all on function public.upsert_group_account_mapping(uuid,uuid,uuid,uuid) from public,anon;
revoke all on function public.get_group_account_mapping(uuid) from public,anon;
grant execute on function public.get_group_reporting_accounts(uuid) to authenticated;
grant execute on function public.upsert_group_reporting_account(uuid,text,text,text,text,integer) to authenticated;
grant execute on function public.upsert_group_account_mapping(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.get_group_account_mapping(uuid) to authenticated;
