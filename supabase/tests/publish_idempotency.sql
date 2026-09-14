-- Regression test for the published-import boundary.
-- Run against a non-production environment containing a published import.
-- The test must use an import that is already status=published.

do $$
declare
  v_import_id uuid := 'b9fc906f-82e9-4498-8a73-1d487867da5a';
  v_before bigint;
  v_after bigint;
  v_error text := null;
begin
  select count(*) into v_before
  from public.financial_facts
  where source_import_id = v_import_id;

  begin
    perform public.publish_actuals_from_import(v_import_id, 'v1');
  exception when others then
    v_error := sqlerrm;
  end;

  select count(*) into v_after
  from public.financial_facts
  where source_import_id = v_import_id;

  if v_error is null then
    raise exception 'IDEMPOTENCY_TEST_FAILED: republish unexpectedly succeeded';
  end if;

  if v_after <> v_before then
    raise exception 'IDEMPOTENCY_TEST_FAILED: financial_facts changed from % to %', v_before, v_after;
  end if;
end $$;
