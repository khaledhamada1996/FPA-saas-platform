-- Normalize SECURITY DEFINER function search paths without changing function bodies.
-- This migration intentionally uses ALTER FUNCTION because several legacy overloads
-- have parameter defaults that PostgreSQL will not allow CREATE OR REPLACE to change.

alter function public.create_workspace(text,text,smallint) set search_path = '';
alter function public.create_workspace(text,text,smallint,jsonb) set search_path = '';
alter function public.create_planning_version(uuid,text,text) set search_path = '';
alter function public.ingest_validated_import(uuid,text,text,jsonb) set search_path = '';
alter function public.publish_actuals_from_import(uuid,text) set search_path = '';
alter function public.submit_planning_version(uuid) set search_path = '';
alter function public.review_planning_version(uuid,text,text) set search_path = '';
alter function public.get_my_notifications(integer) set search_path = '';
alter function public.get_planning_approval_policy(uuid) set search_path = '';
alter function public.get_planning_workspace(uuid) set search_path = '';
alter function public.create_monthly_financial_periods(uuid,integer) set search_path = '';
alter function public.delete_workspace(uuid,text) set search_path = '';
alter function public.configure_planning_approval_policy(uuid,text) set search_path = '';
alter function public.get_my_workspaces() set search_path = '';
alter function public.mark_notification_read(uuid) set search_path = '';
alter function public.has_org_permission(uuid,text) set search_path = '';
alter function public.is_org_member(uuid) set search_path = '';
alter function public.is_org_admin(uuid) set search_path = '';
alter function public.write_audit_event(uuid,text,text,text,jsonb,jsonb) set search_path = '';
alter function public.audit_material_mutation() set search_path = '';
alter function public.has_org_data_scope(uuid,text,uuid) set search_path = '';
