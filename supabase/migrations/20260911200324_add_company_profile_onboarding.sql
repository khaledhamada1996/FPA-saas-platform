alter table public.organizations
  add column if not exists legal_name text,
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists address text,
  add column if not exists industry text,
  add column if not exists company_size text,
  add column if not exists tax_id text,
  add column if not exists registration_number text,
  add column if not exists website text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists initial_data_source text
    check (initial_data_source is null or initial_data_source in ('excel', 'manual', 'integration'));

create or replace function public.create_workspace(
  p_name text default null,
  p_base_currency text default 'SAR',
  p_fiscal_year_start_month smallint default 1,
  p_company_profile jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  new_organization_id uuid;
  new_slug text;
  v_name text;
  v_currency text;
  v_month smallint;
  v_source text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_name := coalesce(nullif(trim(p_name), ''), 'مؤسسة جديدة');
  if length(v_name) > 120 then
    raise exception 'Workspace name must not exceed 120 characters';
  end if;

  v_currency := upper(coalesce(nullif(trim(p_base_currency), ''), 'SAR'));
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Base currency must be a three-letter ISO code';
  end if;

  v_month := coalesce(p_fiscal_year_start_month, 1);
  if v_month < 1 or v_month > 12 then
    raise exception 'Fiscal year start month must be between 1 and 12';
  end if;

  v_source := nullif(trim(p_company_profile ->> 'initial_data_source'), '');
  if v_source is not null and v_source not in ('excel', 'manual', 'integration') then
    raise exception 'Initial data source is invalid';
  end if;

  new_slug := regexp_replace(lower(v_name), '[^[:alnum:]]+', '-', 'g');
  new_slug := trim(both '-' from new_slug);
  if new_slug = '' then
    new_slug := 'workspace';
  end if;
  new_slug := left(new_slug, 70) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);

  insert into public.organizations (
    name, slug, base_currency, fiscal_year_start_month,
    legal_name, country, city, address, industry, company_size,
    tax_id, registration_number, website, contact_email, contact_phone,
    initial_data_source
  )
  values (
    v_name, new_slug, v_currency, v_month,
    nullif(trim(p_company_profile ->> 'legal_name'), ''),
    nullif(trim(p_company_profile ->> 'country'), ''),
    nullif(trim(p_company_profile ->> 'city'), ''),
    nullif(trim(p_company_profile ->> 'address'), ''),
    nullif(trim(p_company_profile ->> 'industry'), ''),
    nullif(trim(p_company_profile ->> 'company_size'), ''),
    nullif(trim(p_company_profile ->> 'tax_id'), ''),
    nullif(trim(p_company_profile ->> 'registration_number'), ''),
    nullif(trim(p_company_profile ->> 'website'), ''),
    nullif(trim(p_company_profile ->> 'contact_email'), ''),
    nullif(trim(p_company_profile ->> 'contact_phone'), ''),
    v_source
  )
  returning id into new_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization_id, auth.uid(), 'admin');

  return new_organization_id;
end;
$$;

revoke all on function public.create_workspace(text, text, smallint, jsonb) from public;
grant execute on function public.create_workspace(text, text, smallint, jsonb) to authenticated;
