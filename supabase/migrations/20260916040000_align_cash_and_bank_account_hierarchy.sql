-- Align the financial statement hierarchy so cash equivalents is the parent of cash, petty cash and banks.
-- Account codes remain internal identifiers and are not displayed to end users.

update public.activity_account_blueprints
set name_ar = case when code = '1120' then 'البنوك' when code = '1130' then 'الذمم المدينة التجارية' else name_ar end,
    parent_code = case when code = '1120' then '1110' else parent_code end
where code in ('1120','1130');

update public.accounts a
set name = case when a.code = '1110' then 'النقدية وما في حكمها' when a.code = '1120' then 'البنوك' else a.name end,
    parent_account_id = case when a.code = '1120' then (select p.id from public.accounts p where p.organization_id=a.organization_id and p.code='1110' limit 1) else a.parent_account_id end
where a.organization_id = 'dd3306e0-d657-48df-990e-5157a3932b4c'
  and a.code in ('1110','1120');

create or replace function public.seed_activity_chart_of_accounts(p_organization_id uuid, p_activity_key text)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.has_org_permission(p_organization_id,'manage_settings') then raise exception 'FORBIDDEN'; end if;
  if p_activity_key is null or p_activity_key = 'generic' then raise exception 'ACTIVITY_REQUIRED'; end if;

  insert into public.accounts (
    organization_id, code, name, account_type, statement_type, statement_section,
    statement_subclassification, parent_account_id, normal_balance, is_contra
  )
  select
    p_organization_id,
    b.code,
    b.name_ar,
    case
      when b.statement_subclassification = 'asset' then 'asset'
      when b.statement_subclassification = 'liability' then 'liability'
      when b.statement_subclassification = 'equity' then 'equity'
      when b.statement_subclassification = 'revenue' then 'revenue'
      else 'expense'
    end,
    b.statement_type,
    b.statement_section,
    b.statement_subclassification,
    parent.id,
    b.normal_balance,
    b.is_contra
  from public.activity_account_blueprints b
  left join public.accounts parent
    on parent.organization_id = p_organization_id
   and parent.code = b.parent_code
  where b.activity_key = p_activity_key
    and not exists (
      select 1 from public.accounts a
      where a.organization_id = p_organization_id and a.code = b.code
    );

  update public.accounts a
  set name = b.name_ar,
      statement_type = b.statement_type,
      statement_section = b.statement_section,
      statement_subclassification = b.statement_subclassification,
      normal_balance = b.normal_balance,
      is_contra = b.is_contra,
      parent_account_id = parent.id
  from public.activity_account_blueprints b
  left join public.accounts parent
    on parent.organization_id = a.organization_id
   and parent.code = b.parent_code
  where a.organization_id = p_organization_id
    and b.activity_key = p_activity_key
    and a.code = b.code;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

grant execute on function public.seed_activity_chart_of_accounts(uuid,text) to authenticated;
