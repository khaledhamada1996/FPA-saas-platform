-- Harden rolled-back import recovery: avoid filename-regex ambiguity and preserve the full source payload.
create or replace function public.reopen_rolled_back_import_for_edit(p_import_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_status text;
  v_file_name text;
  v_file_hash text;
  v_input_type text;
  v_new uuid := gen_random_uuid();
  v_rows integer;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select i.organization_id, i.status, i.file_name, i.file_hash, i.input_type
    into v_org, v_status, v_file_name, v_file_hash, v_input_type
  from public.imports i
  where i.id = p_import_id
  for update;

  if v_org is null then
    raise exception 'Import not found';
  end if;

  if not (
    public.has_org_permission(v_org,'import.prepare')
    or public.has_org_permission(v_org,'import')
  ) then
    raise exception 'Import preparation permission required';
  end if;

  if v_status <> 'rolled_back' then
    raise exception 'Only rolled back imports can be reopened';
  end if;

  select count(*)
    into v_rows
  from public.import_rows
  where import_id = p_import_id
    and organization_id = v_org;

  if v_rows = 0 then
    raise exception 'Source import rows are not available';
  end if;

  insert into public.imports(
    id, organization_id, file_name, file_hash, status, row_count,
    imported_row_count, error_count, warning_count, created_by,
    mapping_version, input_type
  )
  values (
    v_new,
    v_org,
    case
      when position('.' in reverse(coalesce(v_file_name,''))) > 0 then
        left(v_file_name, length(v_file_name) - position('.' in reverse(v_file_name)))
        || '-reopened'
        || right(v_file_name, position('.' in reverse(v_file_name)))
      else
        coalesce(v_file_name,'import') || '-reopened'
    end,
    case
      when v_file_hash is null then null
      else encode(
        extensions.digest(
          convert_to(v_file_hash || ':' || v_new::text,'UTF8'),
          'sha256'
        ),
        'hex'
      )
    end,
    'uploaded',
    v_rows,
    0,
    0,
    0,
    v_user,
    null,
    v_input_type
  );

  insert into public.import_rows(
    id, import_id, organization_id, row_number, source_key,
    payload, validation_status, validation_message
  )
  select
    gen_random_uuid(),
    v_new,
    organization_id,
    row_number,
    v_new::text || ':' || source_key,
    payload,
    validation_status,
    validation_message
  from public.import_rows
  where import_id = p_import_id
    and organization_id = v_org
  order by row_number;

  insert into public.import_audit_events(
    organization_id, import_id, actor_id, action,
    from_status, to_status, metadata
  )
  values (
    v_org,
    v_new,
    v_user,
    'reopen_from_rollback',
    null,
    'uploaded',
    jsonb_build_object(
      'source_import_id', p_import_id,
      'source_status', 'rolled_back',
      'source_row_count', v_rows,
      'source_preserved', true,
      'source_key_rebased', true,
      'validation_state_preserved', true
    )
  );

  return v_new;
end;
$function$;

revoke all on function public.reopen_rolled_back_import_for_edit(uuid) from public, anon;
grant execute on function public.reopen_rolled_back_import_for_edit(uuid) to authenticated;
