create or replace function public.get_ai_financial_context(p_organization_id uuid, p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.has_org_permission(p_organization_id, 'view') then raise exception 'organization access denied'; end if;
  if not exists (select 1 from public.organizations o where o.id=p_organization_id) then raise exception 'organization not found'; end if;
  if not exists (select 1 from public.financial_periods fp where fp.id=p_period_id and fp.organization_id=p_organization_id) then raise exception 'period not found'; end if;
  select jsonb_build_object(
    'organization_id', p_organization_id,
    'period_id', p_period_id,
    'financial_statements', public.get_financial_statements(p_organization_id,p_period_id),
    'financial_analysis', public.get_financial_analysis(p_organization_id,p_period_id),
    'executive_dashboard', public.get_executive_dashboard(p_organization_id,p_period_id)
  ) into v_result;
  return jsonb_build_object(
    'status','ready',
    'authority','deterministic_financial_engines',
    'ai_role','explanation_only',
    'context',v_result
  );
end;
$$;
revoke all on function public.get_ai_financial_context(uuid,uuid) from public, anon;
grant execute on function public.get_ai_financial_context(uuid,uuid) to authenticated;
