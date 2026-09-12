create or replace function public.get_trial_balance(p_organization_id uuid, p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_period record;
  v_row_count integer;
  v_total_debit bigint;
  v_total_credit bigint;
  v_total_opening bigint;
  v_total_closing bigint;
  v_rows jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_organization_id is null or p_period_id is null then raise exception 'Organization and period are required'; end if;
  if not public.has_org_permission(p_organization_id, 'view') then raise exception 'Not authorized'; end if;

  select id, organization_id, period_start, period_end, status into v_period
  from public.financial_periods where id = p_period_id and organization_id = p_organization_id;
  if v_period.id is null then raise exception 'Financial period not found'; end if;

  with scoped_facts as (
    select ff.account_id, ff.financial_period_id,
      coalesce(ff.debit_minor, case when ff.amount_minor > 0 then ff.amount_minor else 0 end) as debit_minor,
      coalesce(ff.credit_minor, case when ff.amount_minor < 0 then -ff.amount_minor else 0 end) as credit_minor
    from public.financial_facts ff
    where ff.organization_id = p_organization_id and ff.fact_type = 'actual'
      and public.has_org_data_scope(ff.organization_id, 'legal_entity', ff.legal_entity_id)
      and public.has_org_data_scope(ff.organization_id, 'branch', ff.branch_id)
      and public.has_org_data_scope(ff.organization_id, 'department', ff.department_id)
      and public.has_org_data_scope(ff.organization_id, 'cost_center', ff.cost_center_id)
      and public.has_org_data_scope(ff.organization_id, 'region', ff.region_id)
      and public.has_org_data_scope(ff.organization_id, 'product', ff.product_id)
      and public.has_org_data_scope(ff.organization_id, 'project', ff.project_id)
  ),
  account_period as (
    select a.id as account_id, a.code, a.name, a.account_type, a.statement_type, a.statement_section,
      coalesce(sum(case when fp.period_start < v_period.period_start then sf.debit_minor - sf.credit_minor else 0 end),0)::bigint as opening_balance,
      coalesce(sum(case when fp.id = p_period_id then sf.debit_minor else 0 end),0)::bigint as period_debit,
      coalesce(sum(case when fp.id = p_period_id then sf.credit_minor else 0 end),0)::bigint as period_credit
    from public.accounts a join scoped_facts sf on sf.account_id = a.id
    join public.financial_periods fp on fp.id = sf.financial_period_id and fp.organization_id = p_organization_id
    where a.organization_id = p_organization_id
    group by a.id, a.code, a.name, a.account_type, a.statement_type, a.statement_section
  ),
  normalized as (
    select *, (opening_balance + period_debit - period_credit)::bigint as closing_balance
    from account_period where opening_balance <> 0 or period_debit <> 0 or period_credit <> 0
  ),
  final_rows as (
    select account_id, code, name, account_type, statement_type, statement_section, opening_balance,
      case when opening_balance > 0 then opening_balance else 0 end::bigint as opening_debit,
      case when opening_balance < 0 then -opening_balance else 0 end::bigint as opening_credit,
      period_debit, period_credit, closing_balance,
      case when closing_balance > 0 then closing_balance else 0 end::bigint as closing_debit,
      case when closing_balance < 0 then -closing_balance else 0 end::bigint as closing_credit
    from normalized
  )
  select count(*), coalesce(sum(period_debit),0), coalesce(sum(period_credit),0), coalesce(sum(opening_balance),0), coalesce(sum(closing_balance),0), coalesce(jsonb_agg(to_jsonb(final_rows) order by code), '[]'::jsonb)
    into v_row_count, v_total_debit, v_total_credit, v_total_opening, v_total_closing, v_rows
  from final_rows;

  return jsonb_build_object('organization_id', p_organization_id, 'period_id', v_period.id, 'period_start', v_period.period_start, 'period_end', v_period.period_end, 'period_status', v_period.status, 'row_count', v_row_count, 'total_period_debit', v_total_debit, 'total_period_credit', v_total_credit, 'period_difference', v_total_debit - v_total_credit, 'total_opening_balance', v_total_opening, 'total_closing_balance', v_total_closing, 'rows', v_rows);
end;
$function$;

revoke all on function public.get_trial_balance(uuid, uuid) from public, anon;
grant execute on function public.get_trial_balance(uuid, uuid) to authenticated;

comment on function public.get_trial_balance(uuid, uuid) is 'Returns a tenant-scoped trial balance derived from authoritative actual financial facts for a selected financial period. Includes opening, period debit/credit, and closing balances.';