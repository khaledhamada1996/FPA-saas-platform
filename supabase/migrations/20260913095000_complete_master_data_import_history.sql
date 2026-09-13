create or replace function public.get_master_data_import_history(p_organization_id uuid, p_input_type text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.has_org_permission(p_organization_id, 'screen.master_data_import.view')
     or not public.has_org_permission(p_organization_id, 'master_data_import.view') then
    raise exception 'PERMISSION_DENIED';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(x) order by x.created_at desc),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      b.id,
      b.input_type,
      b.file_name,
      b.status,
      b.row_count,
      b.accepted_count,
      b.rejected_count,
      b.error_count,
      b.created_at,
      b.applied_at,
      b.created_by,
      b.applied_by
    from public.master_data_import_batches b
    where b.organization_id = p_organization_id
      and (p_input_type is null or b.input_type = p_input_type)
    order by b.created_at desc
    limit 100
  ) x;

  return jsonb_build_object('items', v_result);
end;
$$;

revoke all on function public.get_master_data_import_history(uuid, text) from public, anon;
grant execute on function public.get_master_data_import_history(uuid, text) to authenticated;
