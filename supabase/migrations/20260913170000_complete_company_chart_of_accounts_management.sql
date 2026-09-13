create or replace function public.get_chart_of_accounts(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_organization_id,'screen.accounts.view') then raise exception 'FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(to_jsonb(a) order by a.code) from public.accounts a where a.organization_id=p_organization_id),'[]'::jsonb);
end; $$;

create or replace function public.create_account(p_organization_id uuid,p_code text,p_name text,p_parent_account_id uuid default null,p_account_type text default 'other',p_statement_type text default null,p_statement_section text default null,p_normal_balance text default 'debit',p_is_contra boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_id uuid; v_parent_org uuid; v_level int;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_organization_id,'accounts.create') then raise exception 'FORBIDDEN'; end if;
 if nullif(trim(p_code),'') is null or nullif(trim(p_name),'') is null then raise exception 'ACCOUNT_CODE_AND_NAME_REQUIRED'; end if;
 if exists(select 1 from public.accounts where organization_id=p_organization_id and code=trim(p_code)) then raise exception 'ACCOUNT_CODE_EXISTS'; end if;
 if p_parent_account_id is not null then
  select organization_id into v_parent_org from public.accounts where id=p_parent_account_id;
  if v_parent_org is distinct from p_organization_id then raise exception 'INVALID_PARENT_ACCOUNT'; end if;
  with recursive chain as (select id,parent_account_id,1 n from public.accounts where id=p_parent_account_id union all select a.id,a.parent_account_id,c.n+1 from public.accounts a join chain c on a.id=c.parent_account_id) select max(n)+1 into v_level from chain;
  if v_level>6 then raise exception 'MAX_ACCOUNT_LEVEL_6'; end if;
 end if;
 if p_normal_balance not in ('debit','credit') then raise exception 'INVALID_NORMAL_BALANCE'; end if;
 insert into public.accounts(organization_id,code,name,parent_account_id,account_type,statement_type,statement_section,normal_balance,is_contra) values(p_organization_id,trim(p_code),trim(p_name),p_parent_account_id,nullif(trim(p_account_type),''),p_statement_type,p_statement_section,p_normal_balance,p_is_contra) returning id into v_id;
 perform public.write_audit_event(p_organization_id,'account.create','account',v_id::text,null,'{"source":"manual"}'::jsonb); return v_id;
end; $$;

create or replace function public.update_account(p_organization_id uuid,p_account_id uuid,p_code text,p_name text,p_parent_account_id uuid default null,p_account_type text default null,p_statement_type text default null,p_statement_section text default null,p_normal_balance text default null,p_is_contra boolean default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_old jsonb; v_parent_org uuid; v_level int;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_organization_id,'accounts.edit') then raise exception 'FORBIDDEN'; end if;
 select to_jsonb(a) into v_old from public.accounts a where a.id=p_account_id and a.organization_id=p_organization_id;
 if v_old is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
 if p_parent_account_id=p_account_id then raise exception 'ACCOUNT_CANNOT_BE_OWN_PARENT'; end if;
 if p_parent_account_id is not null then
  select organization_id into v_parent_org from public.accounts where id=p_parent_account_id;
  if v_parent_org is distinct from p_organization_id then raise exception 'INVALID_PARENT_ACCOUNT'; end if;
  with recursive chain as (select id,parent_account_id,1 n from public.accounts where id=p_parent_account_id union all select a.id,a.parent_account_id,c.n+1 from public.accounts a join chain c on a.id=c.parent_account_id) select max(n)+1 into v_level from chain;
  if v_level>6 then raise exception 'MAX_ACCOUNT_LEVEL_6'; end if;
  if exists(with recursive descendants as (select id from public.accounts where id=p_account_id union all select a.id from public.accounts a join descendants d on a.parent_account_id=d.id) select 1 from descendants where id=p_parent_account_id) then raise exception 'ACCOUNT_PARENT_CYCLE'; end if;
 end if;
 if exists(select 1 from public.accounts where organization_id=p_organization_id and code=trim(p_code) and id<>p_account_id) then raise exception 'ACCOUNT_CODE_EXISTS'; end if;
 update public.accounts set code=trim(p_code),name=trim(p_name),parent_account_id=p_parent_account_id,account_type=coalesce(nullif(trim(p_account_type),''),account_type),statement_type=coalesce(p_statement_type,statement_type),statement_section=coalesce(p_statement_section,statement_section),normal_balance=coalesce(p_normal_balance,normal_balance),is_contra=coalesce(p_is_contra,is_contra) where id=p_account_id and organization_id=p_organization_id;
 perform public.write_audit_event(p_organization_id,'account.update','account',p_account_id::text,v_old,(select to_jsonb(a) from public.accounts a where a.id=p_account_id)); return true;
end; $$;

create or replace function public.delete_account(p_organization_id uuid,p_account_id uuid) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_old jsonb;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_organization_id,'accounts.delete') then raise exception 'FORBIDDEN'; end if;
 select to_jsonb(a) into v_old from public.accounts a where a.id=p_account_id and a.organization_id=p_organization_id;
 if v_old is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
 if exists(select 1 from public.accounts where parent_account_id=p_account_id) then raise exception 'ACCOUNT_HAS_CHILDREN'; end if;
 if exists(select 1 from public.financial_facts where account_id=p_account_id) or exists(select 1 from public.budget_lines where account_id=p_account_id) or exists(select 1 from public.forecast_lines where account_id=p_account_id) then raise exception 'ACCOUNT_IN_USE'; end if;
 delete from public.accounts where id=p_account_id and organization_id=p_organization_id;
 perform public.write_audit_event(p_organization_id,'account.delete','account',p_account_id::text,v_old,null); return true;
end; $$;

revoke all on function public.get_chart_of_accounts(uuid) from public,anon; grant execute on function public.get_chart_of_accounts(uuid) to authenticated;
revoke all on function public.create_account(uuid,text,text,uuid,text,text,text,text,boolean) from public,anon; grant execute on function public.create_account(uuid,text,text,uuid,text,text,text,text,boolean) to authenticated;
revoke all on function public.update_account(uuid,uuid,text,text,uuid,text,text,text,text,boolean) from public,anon; grant execute on function public.update_account(uuid,uuid,text,text,uuid,text,text,text,text,boolean) to authenticated;
revoke all on function public.delete_account(uuid,uuid) from public,anon; grant execute on function public.delete_account(uuid,uuid) to authenticated;

create index if not exists idx_accounts_org_code on public.accounts(organization_id,code);
create index if not exists idx_accounts_org_parent on public.accounts(organization_id,parent_account_id);

insert into public.organization_role_permissions(organization_id,role_key,permission_key)
select o.id,r.role_key,p.permission_key from public.organizations o cross join (values ('company_admin'),('executive_director')) r(role_key) cross join (values ('accounts.create'),('accounts.edit'),('accounts.delete')) p(permission_key)
where not exists (select 1 from public.organization_role_permissions x where x.organization_id=o.id and x.role_key=r.role_key and x.permission_key=p.permission_key);

insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select m.organization_id,m.user_id,p.permission_key,true from public.organization_members m join public.organization_role_permissions p on p.organization_id=m.organization_id and p.role_key=m.role
where m.permissions_initialized=true and m.role in ('company_admin','executive_director') and p.permission_key in ('accounts.create','accounts.edit','accounts.delete')
on conflict (organization_id,user_id,permission_key) do update set granted=excluded.granted;
