revoke execute on function public.is_org_admin(uuid) from anon;
revoke execute on function public.is_org_admin(uuid) from public;
grant execute on function public.is_org_admin(uuid) to authenticated;
revoke execute on function public.validate_account_mapping_approval_audit() from anon, authenticated, public;
