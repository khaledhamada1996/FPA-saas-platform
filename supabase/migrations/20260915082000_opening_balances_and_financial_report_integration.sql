-- Opening balances are a separate baseline source in the Financial Data Hub.
-- They affect Balance Sheet / cash / equity reporting only after approval or lock.

create table if not exists public.opening_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  opening_date date not null,
  branch_id uuid,
  department_id uuid,
  cost_center_id uuid,
  region_id uuid,
  product_id uuid,
  project_id uuid,
  currency character(3) not null default 'SAR',
  debit_minor bigint not null default 0,
  credit_minor bigint not null default 0,
  description text,
  status text not null default 'draft' check (status in ('draft','approved','locked')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (debit_minor >= 0 and credit_minor >= 0 and not (debit_minor > 0 and credit_minor > 0))
);

alter table public.opening_balances enable row level security;
revoke all on table public.opening_balances from public, anon, authenticated;

alter table public.opening_balances drop constraint if exists opening_balances_org_account;
drop index if exists public.opening_balances_org_account;
create unique index if not exists opening_balances_org_account
  on public.opening_balances (organization_id, account_id, opening_date, branch_id, department_id, cost_center_id, region_id, product_id, project_id, currency)
  nulls not distinct;
create index if not exists idx_opening_balances_org_date on public.opening_balances (organization_id, opening_date);
create index if not exists idx_opening_balances_org_account_date on public.opening_balances (organization_id, account_id, opening_date);

grant execute on function public.get_opening_balances(uuid,date) to authenticated;
grant execute on function public.upsert_opening_balance(uuid,uuid,date,bigint,bigint,uuid,uuid,uuid,uuid,uuid,uuid,character,text,text) to authenticated;
grant execute on function public.validate_opening_balances(uuid,date) to authenticated;

create or replace function public.get_opening_balances(p_organization_id uuid, p_opening_date date)
returns table(id uuid, account_id uuid, account_code text, account_name text, opening_date date, branch_id uuid, department_id uuid, cost_center_id uuid, region_id uuid, product_id uuid, project_id uuid, currency character, debit_minor bigint, credit_minor bigint, description text, status text)
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=auth.uid())
     and not exists (select 1 from public.organizations o where o.id=p_organization_id and o.owner_user_id=auth.uid()) then
    raise exception 'not authorized';
  end if;
  return query
    select ob.id,ob.account_id,a.code,a.name,ob.opening_date,ob.branch_id,ob.department_id,ob.cost_center_id,ob.region_id,ob.product_id,ob.project_id,ob.currency,ob.debit_minor,ob.credit_minor,ob.description,ob.status
    from public.opening_balances ob
    join public.accounts a on a.id=ob.account_id and a.organization_id=ob.organization_id
    where ob.organization_id=p_organization_id and ob.opening_date=p_opening_date
    order by a.code,ob.id;
end;
$$;

create or replace function public.upsert_opening_balance(p_organization_id uuid, p_account_id uuid, p_opening_date date, p_debit_minor bigint default 0, p_credit_minor bigint default 0, p_branch_id uuid default null, p_department_id uuid default null, p_cost_center_id uuid default null, p_region_id uuid default null, p_product_id uuid default null, p_project_id uuid default null, p_currency character default 'SAR', p_description text default null, p_status text default 'draft')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.organizations o where o.id=p_organization_id and o.owner_user_id=auth.uid())
     and not exists (select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=auth.uid() and coalesce(om.role_key,om.role) in ('owner','admin','accountant')) then
    raise exception 'not authorized';
  end if;
  if p_debit_minor < 0 or p_credit_minor < 0 or (p_debit_minor > 0 and p_credit_minor > 0) or (p_debit_minor = 0 and p_credit_minor = 0) then
    raise exception 'invalid opening balance';
  end if;
  if p_status not in ('draft','approved','locked') then raise exception 'invalid status'; end if;
  if not exists (select 1 from public.accounts a where a.id=p_account_id and a.organization_id=p_organization_id) then raise exception 'account does not belong to organization'; end if;
  insert into public.opening_balances(organization_id,account_id,opening_date,branch_id,department_id,cost_center_id,region_id,product_id,project_id,currency,debit_minor,credit_minor,description,status,created_by,updated_at)
  values(p_organization_id,p_account_id,p_opening_date,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_currency,p_debit_minor,p_credit_minor,p_description,p_status,auth.uid(),now())
  on conflict (organization_id,account_id,opening_date,branch_id,department_id,cost_center_id,region_id,product_id,project_id,currency)
  do update set debit_minor=excluded.debit_minor,credit_minor=excluded.credit_minor,description=excluded.description,status=excluded.status,updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.validate_opening_balances(p_organization_id uuid, p_opening_date date)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_debit numeric; v_credit numeric; v_count integer;
begin
  if not exists(select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=auth.uid())
     and not exists(select 1 from public.organizations o where o.id=p_organization_id and o.owner_user_id=auth.uid()) then raise exception 'not authorized'; end if;
  select count(*),coalesce(sum(debit_minor),0),coalesce(sum(credit_minor),0)
    into v_count,v_debit,v_credit
    from public.opening_balances
    where organization_id=p_organization_id and opening_date=p_opening_date and status in ('approved','locked');
  return jsonb_build_object('opening_date',p_opening_date,'line_count',v_count,'debit_minor',v_debit,'credit_minor',v_credit,'difference_minor',v_debit-v_credit,'balanced',v_debit=v_credit);
end;
$$;

-- Date-range financial statements route through the optimized period engine when aligned to a period,
-- and through transaction_date for arbitrary dates. Approved/locked opening balances are then applied
-- as a baseline without touching the income statement.
create or replace function public.get_financial_statements_date_range_exact(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_journal_no text default null,
  p_cash_flow_method text default 'indirect'
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb; v_period_aligned boolean; v_opening_date date; v_opening jsonb; v_bs jsonb; v_accounts jsonb; v_account jsonb; v_new_accounts jsonb:='[]'::jsonb;
  v_total_assets numeric:=0; v_total_liabilities numeric:=0; v_total_equity numeric:=0; v_opening_equity numeric:=0; v_opening_cash numeric:=0;
  v_code text; v_id uuid; v_open_debit numeric; v_open_credit numeric; v_open_balance numeric; v_eq_rows jsonb:='[]'::jsonb; v_eq_row jsonb; v_eq_open numeric; v_eq_closing numeric; v_displayed_equity numeric:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (public.has_org_permission(p_organization_id,'screen.financial_statements.view') or public.has_org_permission(p_organization_id,'statements.view') or public.has_org_permission(p_organization_id,'view')) then raise exception 'Financial statements view permission required'; end if;
  if p_start_date is null or p_end_date is null or p_start_date>p_end_date then raise exception 'Invalid date range'; end if;
  if p_cash_flow_method not in ('direct','indirect') then raise exception 'Invalid cash flow method'; end if;

  if p_journal_no is not null then
    select public.get_financial_statements_date_range_exact_raw(p_organization_id,p_start_date,p_end_date,p_journal_no,p_cash_flow_method) into r;
  else
    select exists(select 1 from public.financial_periods p where p.organization_id=p_organization_id and p.period_start=p_start_date and p.period_end=p_end_date) into v_period_aligned;
    if v_period_aligned then
      select public.get_financial_statements_date_range(p_organization_id,p_start_date,p_end_date,null,null,null,null,null,null,null,p_cash_flow_method) into r;
    else
      select public.get_financial_statements_date_range_exact_raw(p_organization_id,p_start_date,p_end_date,null,p_cash_flow_method) into r;
    end if;
  end if;

  select max(ob.opening_date) into v_opening_date from public.opening_balances ob where ob.organization_id=p_organization_id and ob.opening_date<=p_start_date and ob.status in ('approved','locked');
  if v_opening_date is null then return r; end if;

  select coalesce(jsonb_agg(jsonb_build_object('account_id',x.account_id,'debit',x.debit,'credit',x.credit,'balance',x.debit-x.credit)),'[]'::jsonb)
    into v_opening
    from (select ob.account_id,sum(ob.debit_minor)::numeric debit,sum(ob.credit_minor)::numeric credit from public.opening_balances ob where ob.organization_id=p_organization_id and ob.opening_date=v_opening_date and ob.status in ('approved','locked') group by ob.account_id) x;

  v_bs:=coalesce(r->'balance_sheet','{}'::jsonb); v_accounts:=coalesce(v_bs->'accounts','[]'::jsonb);
  for v_account in select value from jsonb_array_elements(v_accounts) loop
    v_code:=v_account->>'code';
    select a.id into v_id from public.accounts a where a.organization_id=p_organization_id and a.code=v_code limit 1;
    v_open_debit:=coalesce((select (e->>'debit')::numeric from jsonb_array_elements(v_opening) e where (e->>'account_id')::uuid=v_id limit 1),0);
    v_open_credit:=coalesce((select (e->>'credit')::numeric from jsonb_array_elements(v_opening) e where (e->>'account_id')::uuid=v_id limit 1),0);
    v_open_balance:=v_open_debit-v_open_credit;
    v_account:=jsonb_set(jsonb_set(jsonb_set(v_account,'{debit}',to_jsonb(coalesce((v_account->>'debit')::numeric,0)+v_open_debit)),'{credit}',to_jsonb(coalesce((v_account->>'credit')::numeric,0)+v_open_credit)),'{balance}',to_jsonb(coalesce((v_account->>'balance')::numeric,0)+v_open_balance));
    v_new_accounts:=v_new_accounts||jsonb_build_array(v_account);
    if lower(coalesce(v_account->>'account_type',''))='asset' then v_total_assets:=v_total_assets+(v_account->>'balance')::numeric;
    elsif lower(coalesce(v_account->>'account_type',''))='liability' then v_total_liabilities:=v_total_liabilities-(v_account->>'balance')::numeric;
    elsif lower(coalesce(v_account->>'account_type',''))='equity' then v_total_equity:=v_total_equity-(v_account->>'balance')::numeric;
    end if;
  end loop;

  v_opening_equity:=coalesce((select sum((ob.debit_minor-ob.credit_minor)::numeric) from public.opening_balances ob join public.accounts a on a.id=ob.account_id where ob.organization_id=p_organization_id and ob.opening_date=v_opening_date and ob.status in ('approved','locked') and a.account_type='equity'),0);
  v_opening_cash:=coalesce((select sum((ob.debit_minor-ob.credit_minor)::numeric) from public.opening_balances ob join public.accounts a on a.id=ob.account_id where ob.organization_id=p_organization_id and ob.opening_date=v_opening_date and ob.status in ('approved','locked') and a.statement_subclassification='asset' and a.cash_flow_role='cash'),0);
  v_displayed_equity:=v_total_equity+coalesce((v_bs->>'ytd_net_income')::numeric,0)-coalesce((v_bs->>'current_year_profit_account_balance')::numeric,0);

  v_bs:=jsonb_set(v_bs,'{accounts}',v_new_accounts); v_bs:=jsonb_set(v_bs,'{total_assets}',to_jsonb(v_total_assets)); v_bs:=jsonb_set(v_bs,'{total_liabilities}',to_jsonb(v_total_liabilities)); v_bs:=jsonb_set(v_bs,'{equity_accounts_total}',to_jsonb(v_total_equity)); v_bs:=jsonb_set(v_bs,'{total_equity}',to_jsonb(v_displayed_equity)); v_bs:=jsonb_set(v_bs,'{balance_check}',to_jsonb(v_total_assets-v_total_liabilities-v_displayed_equity)); v_bs:=jsonb_set(v_bs,'{opening_balance_date}',to_jsonb(v_opening_date)); v_bs:=jsonb_set(v_bs,'{opening_equity}',to_jsonb(-v_opening_equity)); r:=jsonb_set(r,'{balance_sheet}',v_bs);

  if r ? 'cash_flow' then
    r:=jsonb_set(r,'{cash_flow,opening_cash}',to_jsonb(coalesce((r->'cash_flow'->>'opening_cash')::numeric,0)+v_opening_cash)); r:=jsonb_set(r,'{cash_flow,closing_cash}',to_jsonb(coalesce((r->'cash_flow'->>'closing_cash')::numeric,0)+v_opening_cash)); r:=jsonb_set(r,'{cash_flow,opening_balance_date}',to_jsonb(v_opening_date));
  end if;

  if r ? 'equity_statement' then
    for v_eq_row in select value from jsonb_array_elements(coalesce(r->'equity_statement'->'rows','[]'::jsonb)) loop
      select a.id into v_id from public.accounts a where a.organization_id=p_organization_id and a.code=v_eq_row->>'code' limit 1;
      v_eq_open:=coalesce((select (e->>'balance')::numeric from jsonb_array_elements(v_opening) e where (e->>'account_id')::uuid=v_id limit 1),0);
      v_eq_closing:=coalesce((v_eq_row->>'closing')::numeric,0)+v_eq_open;
      v_eq_row:=jsonb_set(jsonb_set(v_eq_row,'{opening}',to_jsonb(coalesce((v_eq_row->>'opening')::numeric,0)+v_eq_open)),'{closing}',to_jsonb(v_eq_closing));
      v_eq_rows:=v_eq_rows||jsonb_build_array(v_eq_row);
    end loop;
    r:=jsonb_set(r,'{equity_statement,rows}',v_eq_rows); r:=jsonb_set(r,'{equity_statement,opening_equity}',to_jsonb(-v_opening_equity)); r:=jsonb_set(r,'{equity_statement,displayed_closing_equity}',to_jsonb(v_displayed_equity)); r:=jsonb_set(r,'{equity_statement,opening_balance_date}',to_jsonb(v_opening_date));
  end if;

  r:=jsonb_set(r,'{methodology,opening_balances}',jsonb_build_object('included',true,'opening_date',v_opening_date,'source','opening_balances','note','Approved or locked opening balances are included before journal movements'));
  return r;
end;
$$;

revoke execute on function public.get_financial_statements_date_range_exact(uuid,date,date,text,text) from public, anon;
grant execute on function public.get_financial_statements_date_range_exact(uuid,date,date,text,text) to authenticated;
revoke execute on function public.get_opening_balances(uuid,date) from public, anon;
revoke execute on function public.upsert_opening_balance(uuid,uuid,date,bigint,bigint,uuid,uuid,uuid,uuid,uuid,uuid,character,text,text) from public, anon;
revoke execute on function public.validate_opening_balances(uuid,date) from public, anon;
