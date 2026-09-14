-- Regression test for the published-import boundary.
-- Run against a development/test environment containing at least one published import.

do $$
declare
  v_import_id uuid;
  v_before bigint;
  v_after bigint;
  v_error text := null;
begin
  select import_id into v_import_id
  from public.actuals_publish_batches
  order by published_at desc
  limit 1;

  if v_import_id is null then
    raise exception 'IDEMPOTENCY_TEST_SKIPPED: no published import exists';
  end if;

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
