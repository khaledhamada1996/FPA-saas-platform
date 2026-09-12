create or replace function public.get_planning_workspace(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := (select auth.uid()); v_result jsonb;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=v_user) then raise exception 'Not authorized'; end if;
 select jsonb_build_object(
   'versions', coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from public.planning_versions v where v.organization_id=p_organization_id),'[]'::jsonb),
   'notifications', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from public.notifications n where n.organization_id=p_organization_id and n.recipient_user_id=v_user and n.read_at is null),'[]'::jsonb)
 ) into v_result;
 return v_result;
end; $$;
revoke all on function public.get_planning_workspace(uuid) from public,anon;
grant execute on function public.get_planning_workspace(uuid) to authenticated;

create or replace function public.create_planning_version(p_organization_id uuid,p_version_type text,p_name text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := (select auth.uid()); v_id uuid;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_version_type not in ('budget','forecast','scenario') then raise exception 'Invalid planning version type'; end if;
 if not public.has_org_permission(p_organization_id,'manage_budget') then raise exception 'Not authorized'; end if;
 insert into public.planning_versions(organization_id,version_type,name,status,created_by) values(p_organization_id,p_version_type,trim(p_name),'draft',v_user) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.create_planning_version(uuid,text,text) from public,anon;
grant execute on function public.create_planning_version(uuid,text,text) to authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid := (select auth.uid());
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 update public.notifications set read_at=now() where id=p_notification_id and recipient_user_id=v_user and read_at is null;
end; $$;
revoke all on function public.mark_notification_read(uuid) from public,anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
