-- Fix Chart of Accounts apply lifecycle.
-- Parents may be represented by either account code or exact account name and may
-- exist in the same import batch. The target accounts table does not have is_active.

create or replace function public.apply_account_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid()); v_org uuid; v_status text; v_errors integer;
  v_applied integer := 0; v_remaining integer; v_progress integer; r record; v_parent uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  select organization_id,status,error_count into v_org,v_status,v_errors
  from public.account_import_batches where id=p_batch_id for update;
  if v_org is null then raise exception 'BATCH_NOT_FOUND'; end if;
  if not public.has_org_permission(v_org,'account_import.apply') then raise exception 'FORBIDDEN'; end if;
  if v_status <> 'validated' or coalesce(v_errors,0) > 0 then raise exception 'BATCH_NOT_READY'; end if;
  select count(*) into v_remaining from public.account_import_rows x where x.batch_id=p_batch_id and x.validation_status='valid';
  if v_remaining=0 then raise exception 'NO_VALID_ROWS'; end if;

  for r in select * from public.account_import_rows x
    where x.batch_id=p_batch_id and x.validation_status='valid'
      and nullif(trim(x.parent_account_code),'') is null order by x.row_number loop
    insert into public.accounts(organization_id,code,name,parent_account_id,normal_balance,account_type,statement_type,statement_section,is_contra)
    values(v_org,r.account_code,r.account_name,null,coalesce(r.normal_balance,'debit'),r.account_type,r.statement_classification,null,coalesce(r.is_contra,false))
    on conflict (organization_id,code) do update set
      name=excluded.name,parent_account_id=excluded.parent_account_id,
      normal_balance=excluded.normal_balance,account_type=excluded.account_type,
      statement_type=excluded.statement_type,statement_section=excluded.statement_section,
      is_contra=excluded.is_contra;
  end loop;

  for v_progress in 1..6 loop
    v_progress:=0;
    for r in select * from public.account_import_rows x
      where x.batch_id=p_batch_id and x.validation_status='valid'
        and nullif(trim(x.parent_account_code),'') is not null order by x.row_number loop
      v_parent:=null;
      select a.id into v_parent from public.accounts a
      where a.organization_id=v_org and (a.code=r.parent_account_code or a.name=r.parent_account_code)
      limit 1;
      if v_parent is not null then
        insert into public.accounts(organization_id,code,name,parent_account_id,normal_balance,account_type,statement_type,statement_section,is_contra)
        values(v_org,r.account_code,r.account_name,v_parent,coalesce(r.normal_balance,'debit'),r.account_type,r.statement_classification,null,coalesce(r.is_contra,false))
        on conflict (organization_id,code) do update set
          name=excluded.name,parent_account_id=excluded.parent_account_id,
          normal_balance=excluded.normal_balance,account_type=excluded.account_type,
          statement_type=excluded.statement_type,statement_section=excluded.statement_section,
          is_contra=excluded.is_contra;
        v_progress:=v_progress+1;
      end if;
    end loop;
    exit when v_progress=0;
  end loop;

  select count(*) into v_remaining
  from public.account_import_rows x
  where x.batch_id=p_batch_id and x.validation_status='valid'
    and not exists (select 1 from public.accounts a where a.organization_id=v_org and a.code=x.account_code);
  if v_remaining>0 then raise exception 'UNRESOLVED_PARENT_ACCOUNTS:%',v_remaining; end if;

  select count(*) into v_applied from public.account_import_rows
  where batch_id=p_batch_id and validation_status='valid';
  update public.account_import_batches
  set status='applied',applied_at=now(),applied_by=v_uid,updated_at=now(),accepted_count=v_applied
  where id=p_batch_id;
  perform public.write_audit_event(v_org,'account_import.apply','account_import_batch',p_batch_id::text,null,jsonb_build_object('rows_applied',v_applied));
  return jsonb_build_object('batch_id',p_batch_id,'status','applied','rows_applied',v_applied);
end;
$function$;

revoke all on function public.apply_account_import_batch(uuid) from public, anon;
grant execute on function public.apply_account_import_batch(uuid) to authenticated;
