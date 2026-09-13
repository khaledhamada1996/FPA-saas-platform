insert into public.organization_permissions(permission_key,name,description,permission_type,category,sort_order)
values ('group.view','عرض تقارير المجموعة','عرض بيانات وتقارير الشركات التابعة ضمن المجموعة','read','group_reporting',900),('group.consolidate','التجميع المالي للمجموعة','تشغيل وظائف التجميع المالي للمجموعة','write','group_reporting',901)
on conflict (permission_key) do update set name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,category=excluded.category,sort_order=excluded.sort_order;

insert into public.organization_role_permissions(organization_id,role_key,permission_key)
select o.id,r.role_key,p.permission_key from public.organizations o cross join (values ('company_admin'),('executive_director'),('board')) r(role_key) cross join (values ('group.view'),('group.consolidate')) p(permission_key) on conflict do nothing;

insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select m.organization_id,m.user_id,p.permission_key,true from public.organization_members m join public.organization_permissions p on p.permission_key in ('group.view','group.consolidate') where m.role_key in ('company_admin','executive_director','board') and m.permissions_initialized=true and m.parent_user_id is null on conflict (organization_id,user_id,permission_key) do update set granted=excluded.granted;

create or replace function public.get_group_organizations(p_root_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_uid uuid := (select auth.uid()); v_is_root boolean; v_rows jsonb;
begin
 if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
 select (o.parent_organization_id is null) into v_is_root from public.organizations o where o.id=p_root_organization_id;
 if not coalesce(v_is_root,false) then raise exception 'GROUP_ROOT_REQUIRED'; end if;
 if not public.has_org_permission(p_root_organization_id,'group.view') then raise exception 'FORBIDDEN'; end if;
 with recursive tree as (select o.id,o.name,o.legal_name,o.parent_organization_id,o.base_currency,0 depth,exists(select 1 from public.organization_members m where m.organization_id=o.id and m.user_id=v_uid) is_member from public.organizations o where o.id=p_root_organization_id union all select c.id,c.name,c.legal_name,c.parent_organization_id,c.base_currency,t.depth+1,exists(select 1 from public.organization_members m where m.organization_id=c.id and m.user_id=v_uid) from public.organizations c join tree t on c.parent_organization_id=t.id)
 select coalesce(jsonb_agg(to_jsonb(tree) order by depth,name),'[]'::jsonb) into v_rows from tree;
 return v_rows;
end;$function$;

create or replace function public.get_group_trial_balance(p_root_organization_id uuid,p_period_start date,p_period_end date)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_uid uuid := (select auth.uid()); v_rows jsonb; v_orgs jsonb;
begin
 if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
 if p_period_start is null or p_period_end is null or p_period_start>p_period_end then raise exception 'INVALID_PERIOD_RANGE'; end if;
 if not public.has_org_permission(p_root_organization_id,'group.view') then raise exception 'FORBIDDEN'; end if;
 v_orgs:=public.get_group_organizations(p_root_organization_id);
 with recursive tree as (select o.id from public.organizations o where o.id=p_root_organization_id union all select c.id from public.organizations c join tree t on c.parent_organization_id=t.id), scoped as (select ff.organization_id,ff.account_id,coalesce(ff.debit_minor,case when ff.amount_minor>0 then ff.amount_minor else 0 end) debit_minor,coalesce(ff.credit_minor,case when ff.amount_minor<0 then -ff.amount_minor else 0 end) credit_minor from public.financial_facts ff join tree t on t.id=ff.organization_id join public.financial_periods fp on fp.id=ff.financial_period_id and fp.organization_id=ff.organization_id where ff.fact_type='actual' and fp.period_start>=p_period_start and fp.period_end<=p_period_end and public.has_org_data_scope(ff.organization_id,'legal_entity',ff.legal_entity_id) and public.has_org_data_scope(ff.organization_id,'branch',ff.branch_id) and public.has_org_data_scope(ff.organization_id,'department',ff.department_id) and public.has_org_data_scope(ff.organization_id,'cost_center',ff.cost_center_id) and public.has_org_data_scope(ff.organization_id,'region',ff.region_id) and public.has_org_data_scope(ff.organization_id,'product',ff.product_id) and public.has_org_data_scope(ff.organization_id,'project',ff.project_id)), rows as (select s.organization_id,o.name organization_name,a.code,a.name,a.account_type,sum(s.debit_minor)::bigint period_debit,sum(s.credit_minor)::bigint period_credit,(sum(s.debit_minor)-sum(s.credit_minor))::bigint period_net from scoped s join public.organizations o on o.id=s.organization_id join public.accounts a on a.id=s.account_id and a.organization_id=s.organization_id group by s.organization_id,o.name,a.id,a.code,a.name,a.account_type) select coalesce(jsonb_agg(to_jsonb(rows) order by organization_name,code),'[]'::jsonb) into v_rows from rows;
 return jsonb_build_object('root_organization_id',p_root_organization_id,'period_start',p_period_start,'period_end',p_period_end,'organizations',v_orgs,'rows',v_rows);
end;$function$;

revoke all on function public.get_group_organizations(uuid) from public,anon; grant execute on function public.get_group_organizations(uuid) to authenticated;
revoke all on function public.get_group_trial_balance(uuid,date,date) from public,anon; grant execute on function public.get_group_trial_balance(uuid,date,date) to authenticated;

insert into public.organization_permissions(permission_key,name,description,permission_type,screen_key,route_path,category,sort_order)
values ('screen.group_reporting.view','تقارير المجموعة','مساحة موحدة لعرض الشركات التابعة وميزان المراجعة متعدد الشركات','screen','screen.group_reporting.view','/workspace/group-reporting','group_reporting',902)
on conflict (permission_key) do update set name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,screen_key=excluded.screen_key,route_path=excluded.route_path,category=excluded.category,sort_order=excluded.sort_order;
insert into public.organization_role_permissions(organization_id,role_key,permission_key)
select o.id,r.role_key,'screen.group_reporting.view' from public.organizations o cross join (values ('company_admin'),('executive_director'),('board')) r(role_key) on conflict do nothing;
insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select m.organization_id,m.user_id,'screen.group_reporting.view',true from public.organization_members m where m.role_key in ('company_admin','executive_director','board') and m.permissions_initialized=true and m.parent_user_id is null on conflict (organization_id,user_id,permission_key) do update set granted=excluded.granted;
