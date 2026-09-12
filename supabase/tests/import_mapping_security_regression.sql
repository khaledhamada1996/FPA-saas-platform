-- Structural regression checks for Import & Mapping governance.
-- Full actor-by-actor tests require authenticated sessions for distinct users.

select
  has_function_privilege('anon','public.upsert_account_mapping(uuid,text,text,text,uuid)','EXECUTE') as anon_upsert_mapping_execute,
  has_function_privilege('authenticated','public.upsert_account_mapping(uuid,text,text,text,uuid)','EXECUTE') as authenticated_upsert_mapping_execute,
  has_function_privilege('anon','public.review_account_mapping(uuid,text)','EXECUTE') as anon_review_mapping_execute,
  has_function_privilege('authenticated','public.review_account_mapping(uuid,text)','EXECUTE') as authenticated_review_mapping_execute,
  has_function_privilege('anon','public.prepare_import_for_review(uuid,text)','EXECUTE') as anon_prepare_import_execute,
  has_function_privilege('authenticated','public.prepare_import_for_review(uuid,text)','EXECUTE') as authenticated_prepare_import_execute,
  has_function_privilege('anon','public.reconcile_import(uuid)','EXECUTE') as anon_reconcile_import_execute,
  has_function_privilege('authenticated','public.reconcile_import(uuid)','EXECUTE') as authenticated_reconcile_import_execute,
  has_function_privilege('anon','public.publish_actuals_from_import(uuid,text)','EXECUTE') as anon_publish_execute,
  has_function_privilege('authenticated','public.publish_actuals_from_import(uuid,text)','EXECUTE') as authenticated_publish_execute,
  has_function_privilege('anon','public.rollback_actuals_import(uuid,text)','EXECUTE') as anon_rollback_execute,
  has_function_privilege('authenticated','public.rollback_actuals_import(uuid,text)','EXECUTE') as authenticated_rollback_execute;

with f as (
  select p.proname, pg_get_functiondef(p.oid) as definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in ('upsert_account_mapping','review_account_mapping','prepare_import_for_review','reconcile_import','ingest_validated_import','publish_actuals_from_import','rollback_actuals_import')
)
select proname,
  definition like '%SECURITY DEFINER%' as security_definer,
  definition like '%SET search_path TO ''''' as empty_search_path,
  case
    when proname='review_account_mapping' then definition like '%has_org_permission%' and definition like '%creator cannot approve%'
    when proname='upsert_account_mapping' then definition like '%has_org_permission%' and definition like '%Target account does not belong to this organization%' and definition like '%Approved mapping is immutable%'
    when proname='ingest_validated_import' then definition like '%50000 row limit%' and definition like '%mapping_required%' and definition like '%import_audit_events%'
    when proname='prepare_import_for_review' then definition like '%Approved mapping%' and definition like '%ready_for_review%' and definition like '%mapping_required%'
    when proname='reconcile_import' then definition like '%import_reconciliations%' and definition like '%Approved mapping coverage is incomplete%'
    when proname='rollback_actuals_import' then definition like '%Only published imports can be rolled back%' and definition like '%status = ''rejected''%' and definition like '%status = ''rolled_back''%' and definition like '%action,%' and definition like '%deleted_fact_count%'
    else definition like '%Reconciliation must pass before publishing%' and definition like '%Selected mapping version is not bound to this import%' and definition like '%status=''importing''%'
  end as required_guardrails
from f order by proname;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid='public.imports'::regclass and conname='imports_status_check';

select tablename, policyname
from pg_policies
where schemaname='public' and tablename in ('import_reconciliations','import_audit_events');

-- Expected execute surface:
-- anon_* = false, authenticated_* = true.
-- Expected guardrails = true for all seven functions.
-- Expected imports status constraint includes the documented lifecycle states,
-- including rolled_back.
-- import_reconciliations and import_audit_events intentionally expose no direct RLS policy;
-- writes are performed only by tightly authorized SECURITY DEFINER RPCs.

-- Required authenticated integration cases:
-- 1) Mapping creator cannot approve their own mapping.
-- 2) User without import permission cannot create/update mappings.
-- 3) User without approve/reject permission cannot review mappings.
-- 4) Approved mappings cannot be edited in-place; a new mapping_version is required.
-- 5) Import ingest creates a non-authoritative mapping_required state.
-- 6) An import cannot reach ready_for_review without complete approved mapping coverage.
-- 7) Reconciliation is required before publish.
-- 8) Publish rejects a mapping version different from the one bound to the import.
-- 9) Publish with approved mappings and passed reconciliation succeeds atomically.
-- 10) Re-publishing the same import returns the existing published batch and does not duplicate facts.
-- 11) Rollback requires reject permission, only accepts published imports, preserves source evidence,
--     removes only actual facts sourced from that import, rejects the publish batch, marks the import
--     rolled_back, and records an audit event with reason and deleted fact count.
