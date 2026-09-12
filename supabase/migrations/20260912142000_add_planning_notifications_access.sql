create or replace function public.get_my_notifications(p_limit integer default 50)
returns table(id uuid,notification_type text,title text,body text,entity_type text,entity_id uuid,metadata jsonb,read_at timestamptz,created_at timestamptz)
language sql
security invoker
set search_path=public,pg_temp
as $$
  select n.id,n.notification_type,n.title,n.body,n.entity_type,n.entity_id,n.metadata,n.read_at,n.created_at
  from public.notifications n
  where n.recipient_user_id=(select auth.uid())
  order by n.created_at desc
  limit greatest(1,least(coalesce(p_limit,50),100));
$$;
revoke all on function public.get_my_notifications(integer) from public,anon;
grant execute on function public.get_my_notifications(integer) to authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language sql
security invoker
set search_path=public,pg_temp
as $$
  update public.notifications
  set read_at=coalesce(read_at,now())
  where id=p_notification_id and recipient_user_id=(select auth.uid());
$$;
revoke all on function public.mark_notification_read(uuid) from public,anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
