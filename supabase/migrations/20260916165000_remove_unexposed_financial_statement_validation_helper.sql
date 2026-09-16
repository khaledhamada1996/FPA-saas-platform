-- The financial statements RPC already exposes the authoritative validation payload.
-- Keep the regression check in the report engine rather than adding an exposed
-- SECURITY DEFINER diagnostic RPC.

drop function if exists public.validate_financial_statement_math(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid);
