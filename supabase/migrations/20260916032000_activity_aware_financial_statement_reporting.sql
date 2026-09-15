-- Activity-aware Financial Statements reporting context.
-- The selected company activity drives the reporting template/profile and
-- the IFRS-oriented account blueprint exposed to the statement layer.

create or replace function public.get_financial_statement_reporting_context(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_activity_key text;
  v_activity_name text;
  v_template_key text;
  v_profile jsonb;
  v_sections jsonb;
  v_blueprint jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=auth.uid()) then raise exception 'Organization access required'; end if;
  if not (public.has_org_permission(p_organization_id,'screen.financial_statements.view') or public.has_org_permission(p_organization_id,'statements.view') or public.has_org_permission(p_organization_id,'view')) then raise exception 'Financial statements view permission required'; end if;

  select o.activity_key, fa.name_ar, coalesce(orp.template_key,fa.default_template_key), fa.reporting_profile
    into v_activity_key,v_activity_name,v_template_key,v_profile
  from public.organizations o
  left join public.financial_activities fa on fa.activity_key=o.activity_key
  left join public.organization_reporting_preferences orp on orp.organization_id=o.id
  where o.id=p_organization_id;

  if v_activity_key is null or v_activity_key='generic' then raise exception 'COMPANY_ACTIVITY_REQUIRED'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'code',ab.code,'name',ab.name_ar,'parent_code',ab.parent_code,
      'statement_type',ab.statement_type,'statement_section',ab.statement_section,
      'statement_subclassification',ab.statement_subclassification,
      'normal_balance',ab.normal_balance,'is_contra',ab.is_contra,'sort_order',ab.sort_order
    ) order by ab.sort_order,ab.code),'[]'::jsonb)
    into v_blueprint
  from public.activity_account_blueprints ab
  where ab.activity_key=v_activity_key;

  select coalesce(jsonb_agg(x.section order by x.min_sort),'[]'::jsonb)
    into v_sections
  from (
    select ab.statement_type || ':' || ab.statement_subclassification as section, min(ab.sort_order) as min_sort
    from public.activity_account_blueprints ab
    where ab.activity_key=v_activity_key
    group by ab.statement_type,ab.statement_subclassification
  ) x;

  return jsonb_build_object(
    'activity_key',v_activity_key,
    'activity_name',v_activity_name,
    'template_key',v_template_key,
    'reporting_profile',coalesce(v_profile,'{}'::jsonb),
    'sections',v_sections,
    'blueprint',v_blueprint
  );
end;
$$;

grant execute on function public.get_financial_statement_reporting_context(uuid) to authenticated;

comment on function public.get_financial_statement_reporting_context(uuid) is 'Returns the selected company activity, reporting template, IFRS-oriented presentation profile, and activity account blueprint used by Financial Statements.';
