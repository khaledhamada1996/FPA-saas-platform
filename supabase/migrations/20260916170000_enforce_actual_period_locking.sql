-- Actual financial model governance: lock periods and prevent ordinary fact mutation after lock.
create or replace function public.lock_financial_period(p_period_id uuid)
returns public.financial_periods
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_period public.financial_periods;
  v_previous_status text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_period from public.financial_periods where id = p_period_id for update;
  if not found then raise exception 'Financial period not found'; end if;
  if not public.has_org_permission(v_period.organization_id,'manage_settings') then raise exception 'Not authorized'; end if;
  if v_period.status = 'locked' then return v_period; end if;
  if v_period.status not in ('open','under_review','closed') then raise exception 'Financial period cannot be locked from status %',v_period.status; end if;
  v_previous_status := v_period.status;
  update public.financial_periods set status='locked' where id=p_period_id returning * into v_period;
  insert into public.audit_events(organization_id,actor_user_id,action,target_type,target_id,before_values,after_values)
  values(v_period.organization_id,v_user,'financial_period.lock','financial_period',p_period_id::text,jsonb_build_object('status',v_previous_status),jsonb_build_object('status','locked'));
  return v_period;
end; $$;

create or replace function public.reopen_financial_period(p_period_id uuid,p_reason text)
returns public.financial_periods
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_period public.financial_periods;
  v_reason text := nullif(btrim(p_reason),'');
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_reason is null then raise exception 'Reopening reason is required'; end if;
  select * into v_period from public.financial_periods where id = p_period_id for update;
  if not found then raise exception 'Financial period not found'; end if;
  if not public.has_org_permission(v_period.organization_id,'manage_settings') then raise exception 'Not authorized'; end if;
  if v_period.status <> 'locked' then raise exception 'Only locked periods can be reopened'; end if;
  update public.financial_periods set status='open' where id=p_period_id returning * into v_period;
  insert into public.audit_events(organization_id,actor_user_id,action,target_type,target_id,before_values,after_values)
  values(v_period.organization_id,v_user,'financial_period.reopen','financial_period',p_period_id::text,jsonb_build_object('status','locked'),jsonb_build_object('status','open','reason',v_reason));
  return v_period;
end; $$;

create or replace function public.prevent_actual_fact_mutation_on_locked_period()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_status text;
begin
  select status into v_status from public.financial_periods where id = coalesce(new.financial_period_id,old.financial_period_id);
  if v_status = 'locked' then
    raise exception 'FINANCIAL_PERIOD_LOCKED: actual financial facts cannot be modified while the period is locked';
  end if;
  return coalesce(new,old);
end; $$;

drop trigger if exists trg_prevent_actual_fact_mutation_on_locked_period on public.financial_facts;
create trigger trg_prevent_actual_fact_mutation_on_locked_period
before insert or update or delete on public.financial_facts
for each row execute function public.prevent_actual_fact_mutation_on_locked_period();

revoke execute on function public.lock_financial_period(uuid) from public, anon;
grant execute on function public.lock_financial_period(uuid) to authenticated;
revoke execute on function public.reopen_financial_period(uuid,text) from public, anon;
grant execute on function public.reopen_financial_period(uuid,text) to authenticated;
revoke execute on function public.prevent_actual_fact_mutation_on_locked_period() from public, anon, authenticated;
