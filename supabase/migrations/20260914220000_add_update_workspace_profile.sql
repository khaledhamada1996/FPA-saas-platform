create or replace function public.update_workspace_profile(
  p_organization_id uuid,
  p_name text,
  p_legal_name text,
  p_industry text,
  p_city text,
  p_base_currency text,
  p_fiscal_year_start_month smallint
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.has_org_permission(p_organization_id, 'manage_settings') then
    raise exception 'FORBIDDEN';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'COMPANY_NAME_REQUIRED';
  end if;

  if p_base_currency not in ('SAR','AED','USD','EGP') then
    raise exception 'INVALID_CURRENCY';
  end if;

  if p_fiscal_year_start_month < 1 or p_fiscal_year_start_month > 12 then
    raise exception 'INVALID_FISCAL_MONTH';
  end if;

  update public.organizations
     set name = btrim(p_name),
         legal_name = nullif(btrim(coalesce(p_legal_name, '')), ''),
         industry = nullif(btrim(coalesce(p_industry, '')), ''),
         city = nullif(btrim(coalesce(p_city, '')), ''),
         base_currency = p_base_currency,
         fiscal_year_start_month = p_fiscal_year_start_month,
         updated_at = now()
   where id = p_organization_id;

  if not found then
    raise exception 'COMPANY_NOT_FOUND';
  end if;

  return true;
end;
$function$;

revoke all on function public.update_workspace_profile(uuid,text,text,text,text,text,smallint) from public;
grant execute on function public.update_workspace_profile(uuid,text,text,text,text,text,smallint) to authenticated;
