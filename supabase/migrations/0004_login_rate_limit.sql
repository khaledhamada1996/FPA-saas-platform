-- Login brute-force protection.
-- Three consecutive failed attempts lock the same email/IP key for 15 minutes.

CREATE TABLE IF NOT EXISTS public.login_rate_limits (
  key text PRIMARY KEY,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.login_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_login_rate_limit(p_key text)
RETURNS TABLE(allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked_until timestamptz;
BEGIN
  SELECT locked_until
    INTO v_locked_until
    FROM public.login_rate_limits
   WHERE key = p_key
   FOR UPDATE;

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN QUERY SELECT false, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_locked_until - now())))::integer);
    RETURN;
  END IF;

  IF v_locked_until IS NOT NULL THEN
    UPDATE public.login_rate_limits
       SET failed_attempts = 0, locked_until = NULL, updated_at = now()
     WHERE key = p_key;
  END IF;

  RETURN QUERY SELECT true, 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_login_failure(p_key text)
RETURNS TABLE(locked boolean, retry_after_seconds integer, failed_attempts integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
  v_locked_until timestamptz;
BEGIN
  SELECT failed_attempts, locked_until
    INTO v_attempts, v_locked_until
    FROM public.login_rate_limits
   WHERE key = p_key
   FOR UPDATE;

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN QUERY SELECT true, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_locked_until - now())))::integer), v_attempts;
    RETURN;
  END IF;

  v_attempts := COALESCE(v_attempts, 0) + 1;

  IF v_attempts >= 3 THEN
    v_locked_until := now() + interval '15 minutes';
  ELSE
    v_locked_until := NULL;
  END IF;

  INSERT INTO public.login_rate_limits (key, failed_attempts, locked_until, updated_at)
  VALUES (p_key, v_attempts, v_locked_until, now())
  ON CONFLICT (key) DO UPDATE
    SET failed_attempts = EXCLUDED.failed_attempts,
        locked_until = EXCLUDED.locked_until,
        updated_at = now();

  RETURN QUERY
  SELECT v_attempts >= 3,
         CASE WHEN v_locked_until IS NULL THEN 0 ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_locked_until - now())))::integer) END,
         v_attempts;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_login_failures(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.login_rate_limits WHERE key = p_key;
END;
$$;

REVOKE ALL ON FUNCTION public.check_login_rate_limit(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_login_failure(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_login_failures(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_login_rate_limit(text) TO anon;
GRANT EXECUTE ON FUNCTION public.record_login_failure(text) TO anon;
GRANT EXECUTE ON FUNCTION public.clear_login_failures(text) TO anon;
