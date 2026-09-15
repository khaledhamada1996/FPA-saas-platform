create or replace function public.get_workspace_profile(p_organization_id uuid)
returns table(id uuid, name text, legal_name text, industry text, city text, base_currency text, fiscal_year_start_month smallint, activity_key text, activity_name text, template_key text)
language plpgsql stable security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.has_org_permission(p_organization_id,'manage_settings') then raise exception 'FORBIDDEN'; end if;
  return query
    select o.id,
           o.name,
           o.legal_name,
           o.industry,
           o.city,
           o.base_currency::text,
           o.fiscal_year_start_month,
           o.activity_key,
           fa.name_ar::text,
           orp.template_key::text
    from public.organizations o
    left join public.financial_activities fa on fa.activity_key=o.activity_key
    left join public.organization_reporting_preferences orp on orp.organization_id=o.id
    where o.id=p_organization_id;
  if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
end;
$function$;
