with recursive tree as (
  select a.id,a.parent_account_id,a.code root_code
  from public.accounts a
  where a.organization_id='dd3306e0-d657-48df-990e-5157a3932b4c' and a.code in ('1100','2100')
  union all
  select c.id,c.parent_account_id,t.root_code
  from public.accounts c join tree t on c.parent_account_id=t.id
  where c.organization_id='dd3306e0-d657-48df-990e-5157a3932b4c'
)
update public.accounts a
set cash_flow_working_capital_role=case
  when t.root_code='1100' and a.cash_flow_role is distinct from 'cash' and a.code<>'1100' then 'operating_asset'
  when t.root_code='2100' and a.code<>'2100' then 'operating_liability'
  else a.cash_flow_working_capital_role
end
from tree t where a.id=t.id;

update public.accounts
set cash_flow_role='cash', cash_flow_working_capital_role=null
where organization_id='dd3306e0-d657-48df-990e-5157a3932b4c' and code in ('1120','1123');
