-- Preserve the existing multi-step planning approval workflow while enforcing scoped action permissions.

create or replace function public.submit_planning_version(p_planning_version_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid := (select auth.uid()); v_org uuid; v_status text; v_creator uuid; v_type text; v_policy public.planning_approval_policies%rowtype; v_step record; v_permission text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select pv.organization_id,pv.status,pv.created_by,pv.version_type into v_org,v_status,v_creator,v_type from public.planning_versions pv where pv.id=p_planning_version_id for update;
 if v_org is null then raise exception 'Planning version not found'; end if;
 v_permission:=case v_type when 'budget' then 'budget.submit' when 'forecast' then 'forecast.submit' else 'scenario.run' end;
 if not public.has_org_permission(v_org,v_permission) then raise exception 'Not authorized'; end if;
 if v_creator is distinct from v_user then raise exception 'Only the creator can submit this planning version'; end if;
 if v_status not in ('draft','changes_requested') then raise exception 'Planning version is not editable for submission'; end if;
 if v_type='budget' and not exists(select 1 from public.budget_lines bl where bl.planning_version_id=p_planning_version_id and bl.organization_id=v_org) then raise exception 'Budget cannot be submitted without at least one budget line'; end if;
 select * into v_policy from public.planning_approval_policies p where p.organization_id=v_org and p.is_active=true;
 if not found then raise exception 'Approval policy is not configured'; end if;
 if not exists(select 1 from public.planning_approval_steps s where s.policy_id=v_policy.id) then raise exception 'Approval policy has no approval steps'; end if;
 delete from public.planning_version_approval_steps where planning_version_id=p_planning_version_id;
 for v_step in select s.* from public.planning_approval_steps s where s.policy_id=v_policy.id order by s.step_order loop
  insert into public.planning_version_approval_steps(planning_version_id,step_order,step_name,required_role_key,required_permission_key,allow_submitter,status) values(p_planning_version_id,v_step.step_order,v_step.step_name,v_step.required_role_key,v_step.required_permission_key,v_step.allow_submitter,case when v_step.step_order=1 then 'pending' else 'skipped' end);
 end loop;
 update public.planning_versions set status='submitted',submitted_by=v_user,submitted_at=now(),review_note=null where id=p_planning_version_id;
 for v_step in select s.* from public.planning_version_approval_steps s where s.planning_version_id=p_planning_version_id and s.step_order=1 loop
  if v_step.required_role_key is null then insert into public.notifications(organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id) values(v_org,v_user,'planning_review','Plan ready for approval','Your planning version is ready for approval.','planning_version',p_planning_version_id);
  else insert into public.notifications(organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id) select v_org,m.user_id,'planning_review','Plan awaiting your review','A planning version is waiting for your review and approval.','planning_version',p_planning_version_id from public.organization_members m where m.organization_id=v_org and coalesce(m.role_key,m.role)=v_step.required_role_key;
  end if;
 end loop;
end; $$;

create or replace function public.review_planning_version(p_planning_version_id uuid,p_action text,p_note text default null) returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid := (select auth.uid()); v_org uuid; v_status text; v_creator uuid; v_type text; v_current public.planning_version_approval_steps%rowtype; v_next public.planning_version_approval_steps%rowtype; v_permission text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_action not in ('approve','changes_requested','reject') then raise exception 'Invalid review action'; end if;
 select pv.organization_id,pv.status,pv.created_by,pv.version_type into v_org,v_status,v_creator,v_type from public.planning_versions pv where pv.id=p_planning_version_id for update;
 if v_org is null then raise exception 'Planning version not found'; end if;
 if v_status <> 'submitted' then raise exception 'Planning version is not awaiting review'; end if;
 v_permission:=case when p_action='approve' then v_type||'.approve' else v_type||'.reject' end;
 if not public.has_org_permission(v_org,v_permission) then raise exception 'Not authorized'; end if;
 select s.* into v_current from public.planning_version_approval_steps s where s.planning_version_id=p_planning_version_id and s.status='pending' order by s.step_order limit 1 for update;
 if v_current.id is null then raise exception 'No pending approval step'; end if;
 if v_creator=v_user and not v_current.allow_submitter then raise exception 'Segregation of duties: the submitter cannot approve this step'; end if;
 if v_current.required_role_key is not null and not exists(select 1 from public.organization_members m where m.organization_id=v_org and m.user_id=v_user and coalesce(m.role_key,m.role)=v_current.required_role_key) then raise exception 'User is not assigned to this approval step'; end if;
 if v_current.required_role_key is null and not v_current.allow_submitter then raise exception 'Approval step has no eligible reviewer'; end if;
 update public.planning_version_approval_steps set status=case when p_action='approve' then 'approved' when p_action='changes_requested' then 'changes_requested' else 'rejected' end,decision_note=p_note,decided_by=v_user,decided_at=now(),assigned_to=v_user where id=v_current.id;
 if p_action in ('changes_requested','reject') then
  update public.planning_versions set status='changes_requested',review_note=p_note where id=p_planning_version_id;
  insert into public.notifications(organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id,metadata) values(v_org,v_creator,'planning_changes_requested','Changes requested on your plan',coalesce(p_note,'The reviewer requested changes to your planning version.'),'planning_version',p_planning_version_id,jsonb_build_object('action',p_action));
  return;
 end if;
 select s.* into v_next from public.planning_version_approval_steps s where s.planning_version_id=p_planning_version_id and s.step_order>v_current.step_order and s.status='skipped' order by s.step_order limit 1;
 if v_next.id is null then
  update public.planning_versions set status='approved',approved_at=now(),approved_by=v_user,review_note=p_note where id=p_planning_version_id;
  insert into public.notifications(organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id) values(v_org,v_creator,'planning_approved','Plan approved','Your planning version has been approved.','planning_version',p_planning_version_id);
 else
  update public.planning_version_approval_steps set status='pending' where id=v_next.id;
  if v_next.required_role_key is null then
   if not v_next.allow_submitter then raise exception 'Next approval step has no eligible reviewer'; end if;
   insert into public.notifications(organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id) values(v_org,v_creator,'planning_review','Plan awaiting approval','A planning version is waiting for the next approval step.','planning_version',p_planning_version_id);
  else
   insert into public.notifications(organization_id,recipient_user_id,notification_type,title,body,entity_type,entity_id) select v_org,m.user_id,'planning_review','Plan awaiting your review','A planning version is waiting for your review and approval.','planning_version',p_planning_version_id from public.organization_members m where m.organization_id=v_org and coalesce(m.role_key,m.role)=v_next.required_role_key;
  end if;
 end if;
end; $$;
