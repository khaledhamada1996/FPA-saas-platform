-- Structural regression checks for Import & Mapping governance.
-- Full actor-by-actor tests require authenticated sessions for distinct users.

select
  has_function_privilege('anon','public.upsert_account_mapping(uuid,text,text,text,uuid)','EXECUTE') as anon_upsert_mapping_execute,
  has_function_privilege('authenticated','public.upsert_account_mapping(uuid,text,text,text,uuid)','EXECUTE') as authenticated_upsert_mapping_execute,
  has_function_privilege('anon','public.review_account_mapping(uuid,text)','EXECUTE') as anon_review_mapping_execute,
  has_function_privilege('authenticated','public.review_account_mapping(uuid,text)','EXECUTE') as authenticated_review_mapping_execute,
  has_function_privilege('anon','public.publish_actuals_from_import(uuid,text)','EXECUTE') as anon_publish_execute,
  has_function_privilege('authenticated','public.publish_actuals_from_import(uuid,text)','EXECUTE') as authenticated_publish_execute;

with f as (
  select p.proname, pg_get_functiondef(p.oid) as definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in ('upsert_account_mapping','review_account_mapping','publish_actuals_from_import')
)
select proname,
  definition like '%SECURITY DEFINER%' as security_definer,
  definition like '%SET search_path TO ''''' as empty_search_path,
  case
    when proname='review_account_mapping' then
      definition like '%p_action not in (''approve'',''reject'')%'
      and definition like '%has_org_permission%'
      and definition like '%creator cannot approve%'
    when proname='upsert_account_mapping' then
      definition like '%has_org_permission%'
      and definition like '%Target account does not belong to this organization%'
      and definition like '%Approved mapping is immutable%'
    else
      definition like '%Mapping version is not approved%'
      and definition like '%m.mapping_version=btrim(p_mapping_version)%'
      and definition like '%selected mapping version%'
  end as required_guardrails
from f order by proname;

-- Expected execute surface:
-- anon_* = false, authenticated_* = true.
-- Expected guardrails = true for all three functions.

-- Required authenticated integration cases:
-- 1) Mapping creator cannot approve their own mapping.
-- 2) User without import permission cannot create/update mappings.
-- 3) User without approve/reject permission cannot review mappings.
-- 4) Approved mappings cannot be edited in-place; a new mapping_version is required.
-- 5) Publish with a non-approved or mismatched mapping version must fail.
-- 6) Publish with approved mappings from the selected version must succeed atomically.
-- 7) Re-publishing the same import must return the existing published batch and not create duplicate facts.
