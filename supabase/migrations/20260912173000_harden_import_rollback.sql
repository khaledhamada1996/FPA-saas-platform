-- Controlled rollback for published actuals imports.
-- Preserves source import rows/evidence, removes only authoritative actual facts
-- originating from the selected published import, and records an audit event.

create or replace function public.rollback_actuals_import(p_import_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_batch_id uuid;
  v_deleted_fact_count integer := 0;
  v_current_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_import_id is null then
    raise exception 'Import ID is required';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Rollback reason is required';
  end if;

  if length(p_reason) > 2000 then
    raise exception 'Rollback reason exceeds 2000 characters';
  end if;

  select i.organization_id, i.status
    into v_org_id, v_current_status
  from public.imports i
  where i.id = p_import_id
  for update;

  if v_org_id is null then
    raise exception 'Import not found';
  end if;

  if not public.has_org_permission(v_org_id, 'reject') then
    raise exception 'Insufficient permission to rollback import';
  end if;

  if v_current_status <> 'published' then
    raise exception 'Only published imports can be rolled back';
  end if;

  select b.id
    into v_batch_id
  from public.actuals_publish_batches b
  where b.import_id = p_import_id
    and b.organization_id = v_org_id
    and b.status = 'published'
  order by b.published_at desc nulls last, b.created_at desc
  limit 1
  for update;

  if v_batch_id is null then
    raise exception 'Published batch not found for import';
  end if;

  select count(*)::integer
    into v_deleted_fact_count
  from public.financial_facts f
  where f.organization_id = v_org_id
    and f.source_import_id = p_import_id
    and f.fact_type = 'actual';

  delete from public.financial_facts f
  where f.organization_id = v_org_id
    and f.source_import_id = p_import_id
    and f.fact_type = 'actual';

  update public.actuals_publish_batches
  set status = 'rejected'
  where id = v_batch_id;

  update public.imports
  set status = 'rolled_back'
  where id = p_import_id;

  insert into public.import_audit_events (
    organization_id,
    import_id,
    action,
    from_status,
    to_status,
    actor_user_id,
    metadata
  )
  values (
    v_org_id,
    p_import_id,
    'rollback',
    'published',
    'rolled_back',
    v_user_id,
    jsonb_build_object(
      'batch_id', v_batch_id,
      'reason', p_reason,
      'deleted_fact_count', v_deleted_fact_count
    )
  );

  return v_batch_id;
end;
$$;

revoke all on function public.rollback_actuals_import(uuid, text) from public;
revoke all on function public.rollback_actuals_import(uuid, text) from anon;
grant execute on function public.rollback_actuals_import(uuid, text) to authenticated;
