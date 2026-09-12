-- Regression checks for the planning approval workflow.
-- These checks are intentionally structural and can run against any deployed database.
-- Full actor-by-actor integration tests require authenticated sessions for distinct users.

with f as (
  select
    p.proname,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('review_planning_version', 'submit_planning_version')
)
select
  proname,
  definition like '%SECURITY DEFINER%' as security_definer,
  definition like '%SET search_path TO ''''' as empty_search_path,
  case
    when proname = 'review_planning_version' then
      definition like '%v_creator=v_user and not v_current.allow_submitter%'
      and definition like '%v_current.required_role_key is not null%'
      and definition like '%s.status=''pending''%'
      and definition like '%step_order>v_current.step_order%'
    else
      definition like '%v_creator is distinct from v_user%'
      and definition like '%v_step.allow_submitter%'
      and definition like '%case when v_step.step_order=1 then ''pending'' else ''skipped'' end%'
  end as required_guardrails
from f
order by proname;

-- Expected result for both functions:
-- security_definer = true
-- empty_search_path = true
-- required_guardrails = true

-- Required execute surface:
select
  has_function_privilege('anon', 'public.review_planning_version(uuid,text,text)', 'EXECUTE') as anon_review_execute,
  has_function_privilege('authenticated', 'public.review_planning_version(uuid,text,text)', 'EXECUTE') as authenticated_review_execute,
  has_function_privilege('anon', 'public.submit_planning_version(uuid)', 'EXECUTE') as anon_submit_execute,
  has_function_privilege('authenticated', 'public.submit_planning_version(uuid)', 'EXECUTE') as authenticated_submit_execute;

-- Expected result:
-- anon_review_execute = false
-- authenticated_review_execute = true
-- anon_submit_execute = false
-- authenticated_submit_execute = true

-- Actor-by-actor workflow tests must be executed from authenticated sessions:
-- 1) Finance/creator attempts self-approval: must fail when allow_submitter=false.
-- 2) Finance approval activates only the next CEO step.
-- 3) Finance cannot approve CEO/Board steps while they are skipped.
-- 4) CEO cannot approve before the CEO step becomes pending.
-- 5) CEO approval activates only Board.
-- 6) Board approval finalizes the planning version.
-- 7) Any approval attempt after approved/rejected/changes_requested must fail.
