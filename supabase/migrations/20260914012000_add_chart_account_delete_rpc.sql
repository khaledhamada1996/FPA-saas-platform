create or replace function public.delete_chart_account(p_organization_id uuid,p_account_id uuid)
returns boolean language sql security definer set search_path=''
as $$ select public.delete_account(p_organization_id,p_account_id); $$;

revoke all on function public.delete_chart_account(uuid,uuid) from public,anon;
grant execute on function public.delete_chart_account(uuid,uuid) to authenticated;
