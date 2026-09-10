-- Atomic workspace creation prevents an organization from existing without its creator membership.
-- The function runs with controlled definer privileges and only accepts the current authenticated user.

CREATE OR REPLACE FUNCTION public.create_workspace(
  p_name text,
  p_base_currency text DEFAULT 'SAR',
  p_fiscal_year_start_month smallint DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_organization_id uuid;
  new_slug text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF length(trim(p_name)) < 2 OR length(trim(p_name)) > 120 THEN
    RAISE EXCEPTION 'Workspace name must contain 2 to 120 characters';
  END IF;

  IF p_base_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Base currency must be a three-letter ISO code';
  END IF;

  IF p_fiscal_year_start_month < 1 OR p_fiscal_year_start_month > 12 THEN
    RAISE EXCEPTION 'Fiscal year start month must be between 1 and 12';
  END IF;

  new_slug := regexp_replace(lower(trim(p_name)), '[^[:alnum:]]+', '-', 'g');
  new_slug := trim(both '-' from new_slug);
  new_slug := left(new_slug, 70) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);

  INSERT INTO organizations (name, slug, base_currency, fiscal_year_start_month)
  VALUES (trim(p_name), new_slug, upper(p_base_currency), p_fiscal_year_start_month)
  RETURNING id INTO new_organization_id;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_organization_id, auth.uid(), 'admin');

  RETURN new_organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_workspace(text, text, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_workspace(text, text, smallint) TO authenticated;
