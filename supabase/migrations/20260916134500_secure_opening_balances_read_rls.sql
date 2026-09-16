begin;

create policy opening_balances_select_scoped
on public.opening_balances
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'view')
  and public.has_org_data_scope(organization_id, 'legal_entity', null)
  and public.has_org_data_scope(organization_id, 'branch', branch_id)
  and public.has_org_data_scope(organization_id, 'department', department_id)
  and public.has_org_data_scope(organization_id, 'cost_center', cost_center_id)
  and public.has_org_data_scope(organization_id, 'region', region_id)
  and public.has_org_data_scope(organization_id, 'product', product_id)
  and public.has_org_data_scope(organization_id, 'project', project_id)
);

revoke all on public.opening_balances from anon;
grant select on public.opening_balances to authenticated;

commit;
