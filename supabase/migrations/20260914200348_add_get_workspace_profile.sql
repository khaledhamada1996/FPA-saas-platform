create or replace function public.get_workspace_profile(p_organization_id uuid)
returns table(id uuid,name text,legal_name text,industry text,city text,base_currency text,fiscal_year_start_month smallint)
language plpgsql
stable security definer
set search_path = public, pg_catalog
as $function$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.has_org_permission(p_organization_id, 'manage_settings') then raise exception 'FORBIDDEN'; end if;
  return query select o.id,o.name,o.legal_name,o.industry,o.city,o.base_currency,o.fiscal_year_start_month from public.organizations o where o.id=p_organization_id;
  if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
end;
$function$;
revoke all on function public.get_workspace_profile(uuid) from public;
grant execute on function public.get_workspace_profile(uuid) to authenticated;
