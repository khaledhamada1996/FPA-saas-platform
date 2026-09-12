-- Action-level authorization for the budget module.
-- Existing initialized members are backfilled from their explicit legacy grants.

insert into public.organization_permissions(permission_key,name,description,permission_type,screen_key,route_path,category,sort_order)
values
 ('budget.view','عرض الميزانية','عرض شاشة الميزانية وبياناتها','action','budget','/workspace/budget','planning',1001),
 ('budget.create','إنشاء إصدار ميزانية','إنشاء إصدار ميزانية جديد','action','budget','/workspace/budget','planning',1002),
 ('budget.edit','تعديل الميزانية','إضافة وتعديل بنود الميزانية','action','budget','/workspace/budget','planning',1003),
 ('budget.delete','حذف بند الميزانية','حذف بنود الميزانية القابلة للتعديل','action','budget','/workspace/budget','planning',1004),
 ('budget.submit','إرسال الميزانية','إرسال إصدار الميزانية للمراجعة','action','budget','/workspace/budget','planning',1005),
 ('budget.approve','اعتماد الميزانية','اعتماد إصدار الميزانية','action','budget','/workspace/budget','planning',1006),
 ('budget.reject','رفض الميزانية','رفض الميزانية أو طلب تعديلها','action','budget','/workspace/budget','planning',1007)
on conflict(permission_key) do update set name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,screen_key=excluded.screen_key,route_path=excluded.route_path,category=excluded.category,sort_order=excluded.sort_order;

insert into public.organization_role_permissions(organization_id,role_key,permission_key)
select o.id,r.role_key,p.permission_key
from public.organizations o
cross join (values('company_admin'),('executive_director'),('cfo'),('finance_manager'),('fpa_analyst'),('accountant'),('department_manager'),('viewer')) r(role_key)
cross join (values('budget.view'),('budget.create'),('budget.edit'),('budget.delete'),('budget.submit'),('budget.approve'),('budget.reject')) p(permission_key)
where not exists(select 1 from public.organization_role_permissions x where x.organization_id=o.id and x.role_key=r.role_key and x.permission_key=p.permission_key);

insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select m.organization_id,m.user_id,p.permission_key,true
from public.organization_members m
cross join lateral (values
 ('budget.view',exists(select 1 from public.organization_member_permission_overrides x where x.organization_id=m.organization_id and x.user_id=m.user_id and x.permission_key in('view','manage_budget') and x.granted)),
 ('budget.create',exists(select 1 from public.organization_member_permission_overrides x where x.organization_id=m.organization_id and x.user_id=m.user_id and x.permission_key in('create','manage_budget') and x.granted)),
 ('budget.edit',exists(select 1 from public.organization_member_permission_overrides x where x.organization_id=m.organization_id and x.user_id=m.user_id and x.permission_key in('edit','manage_budget') and x.granted)),
 ('budget.delete',exists(select 1 from public.organization_member_permission_overrides x where x.organization_id=m.organization_id and x.user_id=m.user_id and x.permission_key in('delete','manage_budget') and x.granted)),
 ('budget.submit',exists(select 1 from public.organization_member_permission_overrides x where x.organization_id=m.organization_id and x.user_id=m.user_id and x.permission_key in('submit','manage_budget') and x.granted)),
 ('budget.approve',exists(select 1 from public.organization_member_permission_overrides x where x.organization_id=m.organization_id and x.user_id=m.user_id and x.permission_key in('approve','manage_budget') and x.granted)),
 ('budget.reject',exists(select 1 from public.organization_member_permission_overrides x where x.organization_id=m.organization_id and x.user_id=m.user_id and x.permission_key in('reject','manage_budget') and x.granted))
) p(permission_key,granted)
where m.permissions_initialized=true and p.granted
on conflict(organization_id,user_id,permission_key) do update set granted=excluded.granted;

create or replace function public.create_planning_version(p_organization_id uuid,p_version_type text,p_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_id uuid; v_permission text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_version_type not in('budget','forecast','scenario') then raise exception 'Invalid planning version type'; end if;
 v_permission:=case p_version_type when 'budget' then 'budget.create' when 'forecast' then 'forecast.create' else 'scenario.create' end;
 if not public.has_org_permission(p_organization_id,v_permission) then raise exception 'Not authorized'; end if;
 insert into public.planning_versions(organization_id,version_type,name,status,created_by) values(p_organization_id,p_version_type,trim(p_name),'draft',v_user) returning id into v_id;
 return v_id;
end; $$;

create or replace function public.upsert_budget_line(p_organization_id uuid,p_planning_version_id uuid,p_financial_period_id uuid,p_account_id uuid,p_amount_minor bigint,p_legal_entity_id uuid default null,p_branch_id uuid default null,p_department_id uuid default null,p_cost_center_id uuid default null,p_region_id uuid default null,p_product_id uuid default null,p_project_id uuid default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_id uuid; v_currency char(3); v_status text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if not public.has_org_permission(p_organization_id,'budget.edit') then raise exception 'Budget edit permission required'; end if;
 select status into v_status from public.planning_versions where id=p_planning_version_id and organization_id=p_organization_id and version_type='budget' for update;
 if v_status is null then raise exception 'Budget version not found'; end if;
 if v_status not in('draft','changes_requested') then raise exception 'Budget version is locked for editing'; end if;
 if not exists(select 1 from public.financial_periods where id=p_financial_period_id and organization_id=p_organization_id) then raise exception 'Financial period does not belong to organization'; end if;
 if not exists(select 1 from public.accounts where id=p_account_id and organization_id=p_organization_id) then raise exception 'Account does not belong to organization'; end if;
 select base_currency into v_currency from public.organizations where id=p_organization_id;
 select id into v_id from public.budget_lines where organization_id=p_organization_id and planning_version_id=p_planning_version_id and financial_period_id=p_financial_period_id and account_id=p_account_id and coalesce(legal_entity_id,'00000000-0000-0000-0000-000000000000')=coalesce(p_legal_entity_id,'00000000-0000-0000-0000-000000000000') and coalesce(branch_id,'00000000-0000-0000-0000-000000000000')=coalesce(p_branch_id,'00000000-0000-0000-0000-000000000000') and coalesce(department_id,'00000000-0000-0000-0000-000000000000')=coalesce(p_department_id,'00000000-0000-0000-0000-000000000000') and coalesce(cost_center_id,'00000000-0000-0000-0000-000000000000')=coalesce(p_cost_center_id,'00000000-0000-0000-0000-000000000000') and coalesce(region_id,'00000000-0000-0000-0000-000000000000')=coalesce(p_region_id,'00000000-0000-0000-0000-000000000000') and coalesce(product_id,'00000000-0000-0000-0000-000000000000')=coalesce(p_product_id,'00000000-0000-0000-0000-000000000000') and coalesce(project_id,'00000000-0000-0000-0000-000000000000')=coalesce(p_project_id,'00000000-0000-0000-0000-000000000000') limit 1 for update;
 if v_id is null then insert into public.budget_lines(organization_id,planning_version_id,financial_period_id,account_id,legal_entity_id,branch_id,department_id,cost_center_id,region_id,product_id,project_id,amount_minor,currency,notes,created_by,updated_by) values(p_organization_id,p_planning_version_id,p_financial_period_id,p_account_id,p_legal_entity_id,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id,p_amount_minor,v_currency,p_notes,v_user,v_user) returning id into v_id; else update public.budget_lines set amount_minor=p_amount_minor,notes=p_notes,updated_by=v_user,updated_at=now() where id=v_id; end if;
 return v_id;
end; $$;

create or replace function public.delete_budget_line(p_organization_id uuid,p_budget_line_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not public.has_org_permission(p_organization_id,'budget.delete') then raise exception 'Budget delete permission required'; end if;
 delete from public.budget_lines bl using public.planning_versions pv where bl.id=p_budget_line_id and bl.organization_id=p_organization_id and pv.id=bl.planning_version_id and pv.organization_id=p_organization_id and pv.version_type='budget' and pv.status in('draft','changes_requested');
 if not found then raise exception 'Budget line not found or not editable'; end if;
end; $$;
