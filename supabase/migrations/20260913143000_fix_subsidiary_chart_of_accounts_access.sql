-- Keep subsidiary Chart of Accounts tenant-scoped while ensuring initialized company admins
-- receive the explicit account permissions required by the per-user authorization model.
insert into public.organization_member_permission_overrides (organization_id,user_id,permission_key,granted)
select om.organization_id,om.user_id,p.permission_key,true
from public.organization_members om
join public.organization_permissions p on p.permission_key in ('screen.accounts.view','accounts.create','accounts.edit','accounts.delete')
where om.permissions_initialized=true and om.role_key in ('company_admin','executive_director','board')
on conflict (organization_id,user_id,permission_key) do update set granted=true;

create or replace function public.get_chart_of_accounts(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid := (select auth.uid());
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if not public.has_org_permission(p_organization_id,'screen.accounts.view') then raise exception 'FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.code) from (
   with recursive tree as (
     select a.*,1 as level from public.accounts a where a.organization_id=p_organization_id and a.parent_account_id is null
     union all
     select a.*,t.level+1 from public.accounts a join tree t on a.parent_account_id=t.id where a.organization_id=p_organization_id and t.level<6
   ) select * from tree
 ) x),'[]'::jsonb);
end $$;

create or replace function public.create_chart_account(p_organization_id uuid,p_code text,p_name text,p_parent_account_id uuid default null,p_account_type text default 'other',p_statement_type text default null,p_statement_section text default null,p_normal_balance text default 'debit',p_is_contra boolean default false)
returns uuid language sql security definer set search_path=''
as $$ select public.create_account(p_organization_id,p_code,p_name,p_parent_account_id,p_account_type,p_statement_type,p_statement_section,p_normal_balance,p_is_contra); $$;

create or replace function public.update_chart_account(p_organization_id uuid,p_account_id uuid,p_code text,p_name text,p_parent_account_id uuid default null,p_account_type text default null,p_statement_type text default null,p_statement_section text default null,p_normal_balance text default null,p_is_contra boolean default null)
returns boolean language sql security definer set search_path=''
as $$ select public.update_account(p_organization_id,p_account_id,p_code,p_name,p_parent_account_id,p_account_type,p_statement_type,p_statement_section,p_normal_balance,p_is_contra); $$;

revoke all on function public.get_chart_of_accounts(uuid) from public,anon;
grant execute on function public.get_chart_of_accounts(uuid) to authenticated;
revoke all on function public.create_chart_account(uuid,text,text,uuid,text,text,text,text,boolean) from public,anon;
grant execute on function public.create_chart_account(uuid,text,text,uuid,text,text,text,text,boolean) to authenticated;
revoke all on function public.update_chart_account(uuid,uuid,text,text,uuid,text,text,text,text,boolean) from public,anon;
grant execute on function public.update_chart_account(uuid,uuid,text,text,uuid,text,text,text,text,boolean) to authenticated;
