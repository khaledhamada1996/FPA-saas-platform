-- Fix ambiguous output-column references in login brute-force protection.
-- Keeps the existing 3-failure / 15-minute lockout behavior unchanged.

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
  SELECT lrl.failed_attempts, lrl.locked_until
    INTO v_attempts, v_locked_until
    FROM public.login_rate_limits AS lrl
   WHERE lrl.key = p_key
   FOR UPDATE;

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN QUERY SELECT true,
                        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_locked_until - now())))::integer),
                        v_attempts;
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
         CASE
           WHEN v_locked_until IS NULL THEN 0
           ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_locked_until - now())))::integer)
         END,
         v_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.record_login_failure(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_login_failure(text) TO anon;
