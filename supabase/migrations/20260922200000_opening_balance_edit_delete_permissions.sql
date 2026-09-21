-- Opening balance edit/delete permissions and safe mutation workflow.
insert into public.organization_permissions
(permission_key,name,description,permission_type,screen_key,route_path,category,sort_order)
values
('opening_balances.edit','تعديل الأرصدة الافتتاحية','تعديل الأرصدة الافتتاحية غير المقفلة وإعادتها لمسودة عند التعديل','action','opening_balances','/workspace/data/opening-balances','البيانات الفعلية',220),
('opening_balances.delete','حذف الأرصدة الافتتاحية','حذف الأرصدة الافتتاحية غير المقفلة','action','opening_balances','/workspace/data/opening-balances','البيانات الفعلية',221)
on conflict (permission_key) do update set
name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,
screen_key=excluded.screen_key,route_path=excluded.route_path,category=excluded.category,sort_order=excluded.sort_order;

insert into public.organization_role_permissions(organization_id,role_key,permission_key)
select o.id,r.role_key,p.permission_key
from public.organizations o
cross join (values ('company_admin'),('executive_director'),('cfo'),('finance_manager'),('accountant')) r(role_key)
cross join (values ('opening_balances.edit'),('opening_balances.delete')) p(permission_key)
on conflict do nothing;

create or replace function public.update_opening_balance(
p_organization_id uuid,p_id uuid,p_account_id uuid,p_opening_date date,
p_debit_minor bigint default 0,p_credit_minor bigint default 0,
p_branch_id uuid default null,p_department_id uuid default null,p_cost_center_id uuid default null,
p_region_id uuid default null,p_product_id uuid default null,p_project_id uuid default null,
p_currency character default 'SAR',p_description text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_status text; v_id uuid;
begin
if auth.uid() is null then raise exception 'Authentication required'; end if;
if not public.has_org_permission(p_organization_id,'opening_balances.edit') then raise exception 'Opening balance edit permission required'; end if;
if p_debit_minor < 0 or p_credit_minor < 0 or (p_debit_minor > 0 and p_credit_minor > 0) or (p_debit_minor=0 and p_credit_minor=0) then raise exception 'invalid opening balance'; end if;
if not exists(select 1 from public.accounts a where a.id=p_account_id and a.organization_id=p_organization_id) then raise exception 'account does not belong to organization'; end if;
select status into v_status from public.opening_balances where id=p_id and organization_id=p_organization_id for update;
if v_status is null then raise exception 'Opening balance not found'; end if;
if v_status='locked' then raise exception 'OPENING_BALANCE_LOCKED: locked opening balances cannot be modified'; end if;
update public.opening_balances set account_id=p_account_id,opening_date=p_opening_date,debit_minor=p_debit_minor,credit_minor=p_credit_minor,description=p_description,status='draft',updated_at=now()
where id=p_id and organization_id=p_organization_id returning id into v_id;
return v_id;
end;
$$;

create or replace function public.delete_opening_balance(p_organization_id uuid,p_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_status text;
begin
if auth.uid() is null then raise exception 'Authentication required'; end if;
if not public.has_org_permission(p_organization_id,'opening_balances.delete') then raise exception 'Opening balance delete permission required'; end if;
select status into v_status from public.opening_balances where id=p_id and organization_id=p_organization_id for update;
if v_status is null then raise exception 'Opening balance not found'; end if;
if v_status='locked' then raise exception 'OPENING_BALANCE_LOCKED: locked opening balances cannot be deleted'; end if;
delete from public.opening_balances where id=p_id and organization_id=p_organization_id;
return true;
end;
$$;

revoke all on function public.update_opening_balance(uuid,uuid,uuid,date,bigint,bigint,uuid,uuid,uuid,uuid,uuid,uuid,character,text) from public,anon;
grant execute on function public.update_opening_balance(uuid,uuid,uuid,date,bigint,bigint,uuid,uuid,uuid,uuid,uuid,uuid,character,text) to authenticated;
revoke all on function public.delete_opening_balance(uuid,uuid) from public,anon;
grant execute on function public.delete_opening_balance(uuid,uuid) to authenticated;
