create or replace function public.set_account_cash_flow_mapping(
  p_organization_id uuid,
  p_account_id uuid,
  p_role text,
  p_direct_category text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_type text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_org_permission(p_organization_id,'screen.accounts.edit')
     and not public.has_org_permission(p_organization_id,'accounts.edit')
     and not public.has_org_permission(p_organization_id,'admin') then raise exception 'FORBIDDEN'; end if;
  select account_type into v_type
  from public.accounts
  where id=p_account_id and organization_id=p_organization_id;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if p_role is not null and p_role not in ('cash','non_cash') then raise exception 'INVALID_CASH_FLOW_ROLE'; end if;
  if p_direct_category is not null and p_direct_category not in (
    'operating_inflow','operating_outflow','investing_inflow','investing_outflow',
    'financing_inflow','financing_outflow','non_cash'
  ) then raise exception 'INVALID_CASH_FLOW_CATEGORY'; end if;
  update public.accounts
     set cash_flow_role=p_role,
         cash_flow_direct_category=p_direct_category
   where id=p_account_id and organization_id=p_organization_id;
  return true;
end $$;

revoke all on function public.set_account_cash_flow_mapping(uuid,uuid,text,text) from public,anon;
grant execute on function public.set_account_cash_flow_mapping(uuid,uuid,text,text) to authenticated;
