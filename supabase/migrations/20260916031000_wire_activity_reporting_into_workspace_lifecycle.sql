-- Company activity is mandatory and drives the reporting template.
-- create_workspace and update_workspace_profile persist activity_key and resync
-- the activity-specific reporting account blueprint.

-- The live database migration also exposes:
-- public.get_workspace_profile(uuid)
-- public.get_activity_reporting_blueprint(text)
-- public.seed_activity_chart_of_accounts(uuid,text)
-- and invokes seed_activity_chart_of_accounts from the workspace create/update
-- lifecycle after the organization reporting preference is established.

-- Keep the source-of-truth implementations in the immediately preceding
-- activity_reporting_blueprint_engine migration and the existing workspace
-- lifecycle migration; this file documents the lifecycle contract.
