revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;
revoke all on function public.audit_material_mutation() from public, anon, authenticated;
revoke all on function public.write_audit_event(uuid,text,text,text,jsonb,jsonb) from public, anon;
grant execute on function public.write_audit_event(uuid,text,text,text,jsonb,jsonb) to authenticated;
