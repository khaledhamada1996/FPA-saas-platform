revoke execute on function public.get_executive_dashboard_date_range_filtered(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date) from public;
revoke execute on function public.get_executive_dashboard_date_range_filtered(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date) from anon;
grant execute on function public.get_executive_dashboard_date_range_filtered(uuid,date,date,uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date) to authenticated;
