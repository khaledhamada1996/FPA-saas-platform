create or replace function public.review_planning_version(p_planning_version_id uuid,p_action text,p_note text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid := (select auth.uid()); v_org uuid; v_status text; v_creator uuid; v_current public.planning_version_approval_steps%rowtype; v_next public.planning_version_approval_steps%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_action not in ('approve','changes_requested','reject') then raise exception 'Invalid review action'; end if;
  select pv.organization_id,pv.status,pv.created_by into v_org,v_status,v_creator from public.planning_versions pv where pv.id=p_planning_version_id for update;
  if v_org is null then raise exception 'Planning version not found'; end if;
  if v_status <> 'submitted' then raise exception 'Planning version is not awaiting review'; end if;
  select s.* into v_current from public.planning_version_approval_steps s where s.planning_version_id=p_planning_version_id and s.status='pending' order by s.step_order limit 1 for update;
  if v_current.id is null then raise exception 'No pending approval step'; end if;
  if p_action='approve' and not public.has_org_permission(v_org,'approve') then raise exception 'Not authorized to approve this step'; end if;
  if p_action in ('changes_requested','reject') and not public.has_org_permission(v_org,'reject') then raise exception 'Not authorized to reject/request changes for this step'; end if;
  if v_current.required_role_key is not null and not exists(select 1 from public.organization_members m where m.organization_id=v_org and m.user_id=v_user and coalesce(m.role_key,m.role)=v_current.required_role_key) then raise exception 'User is not assigned to this approval step'; end if;
  if v_current.required_role_key is null and not exists(select 1 from public.planning_approval_steps s join public.planning_approval_policies p on p.id=s.policy_id where p.organization_id=v_org and p.is_active and s.step_order=v_current.step_order and s.allow_submitter and v_creator=v_user) then raise exception 'Self approval is not allowed'; end if;
  update public.planning_version_approval_steps set status=case when p_action='approve' then 'approved' when p_action='changes_requested' then 'changes_requested' else 'rejected' end,decision_note=p_note,decided_by=v_user,decided_at=now(),assigned_to=v_user where id=v_current.id;
  if p_action in ('changes_requested','reject') then
    update public.planning_versions set status='changes_requested',review_note=p_note where id=p_planning_version_id;
    insert into public.notifications(organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id,metadata) values(v_org,v_creator,'planning_changes_requested','Changes requested on your plan',coalesce(p_note,'The reviewer requested changes to your planning version.'),'planning_version',p_planning_version_id,jsonb_build_object('action',p_action));
    return;
  end if;
  select * into v_next from public.planning_version_approval_steps where planning_version_id=p_planning_version_id and step_order>v_current.step_order and status='skipped' order by step_order limit 1;
  if v_next.id is null then
    update public.planning_versions set status='approved',approved_at=now(),approved_by=v_user,review_note=p_note where id=p_planning_version_id;
    insert into public.notifications(organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id) values(v_org,v_creator,'planning_approved','Plan approved','Your planning version has been approved.','planning_version',p_planning_version_id);
  else
    update public.planning_version_approval_steps set status='pending' where id=v_next.id;
    if v_next.required_role_key is null then
      insert into public.notifications(organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id) values(v_org,v_creator,'planning_review','Plan awaiting approval','A planning version is waiting for the next approval step.','planning_version',p_planning_version_id);
    else
      insert into public.notifications(organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id)
      select v_org,m.user_id,'planning_review','Plan awaiting your review','A planning version is waiting for your review and approval.','planning_version',p_planning_version_id from public.organization_members m where m.organization_id=v_org and coalesce(m.role_key,m.role)=v_next.required_role_key;
    end if;
  end if;
end; $$;
revoke all on function public.review_planning_version(uuid,text,text) from public,anon;
grant execute on function public.review_planning_version(uuid,text,text) to authenticated;
