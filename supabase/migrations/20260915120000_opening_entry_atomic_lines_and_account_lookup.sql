drop function if exists public.get_opening_balances(uuid,date);

create or replace function public.create_opening_entry(p_organization_id uuid,p_opening_date date,p_lines jsonb,p_description text default null) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_entry_id uuid:=gen_random_uuid(); v_line jsonb; v_account uuid; v_debit bigint; v_credit bigint; v_total_debit bigint:=0; v_total_credit bigint:=0; v_count integer:=0; v_seen uuid[]:='{}';
begin
 if not exists (select 1 from public.organizations o where o.id=p_organization_id and o.owner_user_id=auth.uid()) and not exists (select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=auth.uid() and coalesce(om.role_key,om.role) in ('owner','admin','accountant','company_admin')) then raise exception 'not authorized'; end if;
 if p_opening_date is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then raise exception 'opening entry requires at least two lines'; end if;
 for v_line in select * from jsonb_array_elements(p_lines) loop
  if nullif(v_line->>'account_id','') is null then raise exception 'account is required'; end if;
  v_account:=(v_line->>'account_id')::uuid; v_debit:=coalesce(nullif(v_line->>'debit_minor','')::bigint,0); v_credit:=coalesce(nullif(v_line->>'credit_minor','')::bigint,0);
  if v_debit<0 or v_credit<0 then raise exception 'amounts cannot be negative'; end if;
  if (v_debit>0 and v_credit>0) or (v_debit=0 and v_credit=0) then raise exception 'each opening entry line must be debit or credit'; end if;
  if not exists(select 1 from public.accounts a where a.id=v_account and a.organization_id=p_organization_id) then raise exception 'account does not belong to organization'; end if;
  if v_account=any(v_seen) then raise exception 'the same account cannot appear twice in one opening entry'; end if; v_seen:=array_append(v_seen,v_account);
  if exists(select 1 from public.opening_balances ob where ob.organization_id=p_organization_id and ob.account_id=v_account and ob.opening_date=p_opening_date and ob.status in ('approved','locked')) then raise exception 'approved or locked opening balance cannot be edited'; end if;
  v_total_debit:=v_total_debit+v_debit; v_total_credit:=v_total_credit+v_credit; v_count:=v_count+1;
 end loop;
 if v_total_debit<>v_total_credit then raise exception 'opening entry is not balanced'; end if;
 for v_line in select * from jsonb_array_elements(p_lines) loop
  v_account:=(v_line->>'account_id')::uuid; v_debit:=coalesce(nullif(v_line->>'debit_minor','')::bigint,0); v_credit:=coalesce(nullif(v_line->>'credit_minor','')::bigint,0);
  insert into public.opening_balances(organization_id,account_id,opening_date,debit_minor,credit_minor,description,status,created_by,updated_at,entry_id) values(p_organization_id,v_account,p_opening_date,v_debit,v_credit,coalesce(nullif(v_line->>'description',''),p_description),'draft',auth.uid(),now(),v_entry_id)
  on conflict (organization_id,account_id,opening_date,branch_id,department_id,cost_center_id,region_id,product_id,project_id,currency) do update set debit_minor=excluded.debit_minor,credit_minor=excluded.credit_minor,description=excluded.description,status='draft',entry_id=v_entry_id,updated_at=now();
 end loop;
 return jsonb_build_object('entry_id',v_entry_id,'line_count',v_count,'debit_minor',v_total_debit,'credit_minor',v_total_credit,'balanced',true);
end;$function$;

create function public.get_opening_balances(p_organization_id uuid,p_opening_date date) returns table(id uuid,account_id uuid,account_code text,account_name text,opening_date date,branch_id uuid,department_id uuid,cost_center_id uuid,region_id uuid,product_id uuid,project_id uuid,currency character,debit_minor bigint,credit_minor bigint,description text,status text,entry_id uuid) language plpgsql security definer set search_path to '' as $function$
begin
 if not exists(select 1 from public.organization_members om where om.organization_id=p_organization_id and om.user_id=auth.uid()) and not exists(select 1 from public.organizations o where o.id=p_organization_id and o.owner_user_id=auth.uid()) then raise exception 'not authorized'; end if;
 return query select ob.id,ob.account_id,a.code,a.name,ob.opening_date,ob.branch_id,ob.department_id,ob.cost_center_id,ob.region_id,ob.product_id,ob.project_id,ob.currency,ob.debit_minor,ob.credit_minor,ob.description,ob.status,ob.entry_id from public.opening_balances ob join public.accounts a on a.id=ob.account_id and a.organization_id=ob.organization_id where ob.organization_id=p_organization_id and ob.opening_date=p_opening_date order by coalesce(ob.entry_id,'00000000-0000-0000-0000-000000000000'::uuid),a.code,ob.id;
end;$function$;

revoke execute on function public.create_opening_entry(uuid,date,jsonb,text) from anon;
revoke execute on function public.get_opening_balances(uuid,date) from anon;
grant execute on function public.create_opening_entry(uuid,date,jsonb,text) to authenticated;
grant execute on function public.get_opening_balances(uuid,date) to authenticated;
