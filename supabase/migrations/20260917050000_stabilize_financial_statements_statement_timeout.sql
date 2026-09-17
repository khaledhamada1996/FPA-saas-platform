-- Prevent the financial-statements reporting RPC from being cancelled by
-- the short project/session statement timeout while it completes its
-- security-scoped reconciliation work. This is a bounded timeout, not an
-- unbounded increase, and keeps the RPC from hanging indefinitely.
ALTER FUNCTION public.get_financial_statements_date_range_filtered(
  uuid,
  date,
  date,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid
) SET statement_timeout = '15s';
