create or replace function public.submit_planning_version(p_planning_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_status text;
  v_creator uuid;
  v_policy public.planning_approval_policies%rowtype;
  v_step record;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select pv.organization_id,pv.status,pv.created_by
    into v_org,v_status,v_creator
  from public.planning_versions pv
  where pv.id=p_planning_version_id
  for update;

  if v_org is null then raise exception 'Planning version not found'; end if;
  if not public.has_org_permission(v_org,'submit') then raise exception 'Not authorized'; end if;
  if v_creator is distinct from v_user then raise exception 'Only the creator can submit this planning version'; end if;
  if v_status not in ('draft','changes_requested') then raise exception 'Planning version is not editable for submission'; end if;

  select * into v_policy
  from public.planning_approval_policies p
  where p.organization_id=v_org and p.is_active=true;
  if not found then raise exception 'Approval policy is not configured'; end if;

  if not exists(select 1 from public.planning_approval_steps s where s.policy_id=v_policy.id) then
    raise exception 'Approval policy has no approval steps';
  end if;

  delete from public.planning_version_approval_steps
  where planning_version_id=p_planning_version_id;

  for v_step in
    select s.* from public.planning_approval_steps s
    where s.policy_id=v_policy.id order by s.step_order
  loop
    insert into public.planning_version_approval_steps(
      planning_version_id,step_order,step_name,required_role_key,
      required_permission_key,allow_submitter,status
    ) values (
      p_planning_version_id,v_step.step_order,v_step.step_name,v_step.required_role_key,
      v_step.required_permission_key,v_step.allow_submitter,
      case when v_step.step_order=1 then 'pending' else 'skipped' end
    );
  end loop;

  update public.planning_versions
  set status='submitted',submitted_by=v_user,submitted_at=now(),review_note=null
  where id=p_planning_version_id;

  for v_step in
    select s.* from public.planning_version_approval_steps s
    where s.planning_version_id=p_planning_version_id and s.step_order=1
  loop
    if v_step.required_role_key is null then
      insert into public.notifications(
        organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id
      ) values (
        v_org,v_user,'planning_review','Plan ready for approval',
        'Your planning version is ready for approval.','planning_version',p_planning_version_id
      );
    else
      insert into public.notifications(
        organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id
      )
      select v_org,m.user_id,'planning_review','Plan awaiting your review',
        'A planning version is waiting for your review and approval.',
        'planning_version',p_planning_version_id
      from public.organization_members m
      where m.organization_id=v_org
        and coalesce(m.role_key,m.role)=v_step.required_role_key;
    end if;
  end loop;
end;
$$;

revoke all on function public.submit_planning_version(uuid) from public,anon;
grant execute on function public.submit_planning_version(uuid) to authenticated;
