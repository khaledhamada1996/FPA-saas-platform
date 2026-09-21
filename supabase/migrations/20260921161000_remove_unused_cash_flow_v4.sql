-- Remove an unused legacy cash-flow wrapper after the canonical get_cash_flow_statement path became the only runtime path.
drop function if exists public.get_cash_flow_statement_v4(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text);
