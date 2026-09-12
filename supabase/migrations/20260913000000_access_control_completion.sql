-- Access-control completion: screen-level permissions, hierarchy-aware team data,
-- company-admin initialization, and least-privilege function grants.

alter table public.organization_permissions
  add column if not exists permission_type text not null default 'action',
  add column if not exists screen_key text,
  add column if not exists route_path text,
  add column if not exists category text,
  add column if not exists sort_order integer not null default 1000;

insert into public.organization_permissions(permission_key,name,description,permission_type,screen_key,route_path,category,sort_order) values
('screen.workspace.view','لوحة مساحة العمل','الوصول إلى الصفحة الرئيسية لمساحة العمل','screen','workspace','/workspace','workspace',10),
('screen.executive_dashboard.view','لوحة المؤشرات التنفيذية','عرض لوحة المؤشرات التنفيذية','screen','executive_dashboard','/workspace/executive-dashboard','management',20),
('screen.actuals.view','البيانات الفعلية','عرض البيانات الفعلية','screen','actuals','/workspace/actuals','data',30),
('screen.data.view','البيانات والاستيراد','الوصول إلى إدارة البيانات والاستيراد','screen','data','/workspace/data','data',40),
('screen.accounts.view','دليل الحسابات','عرض وإدارة دليل الحسابات','screen','accounts','/workspace/data/accounts','data',50),
('screen.data_history.view','سجل البيانات','عرض تاريخ عمليات البيانات','screen','data_history','/workspace/data/history','data',60),
('screen.trial_balance.view','ميزان المراجعة','عرض ميزان المراجعة','screen','trial_balance','/workspace/trial-balance','reporting',70),
('screen.financial_statements.view','القوائم المالية','عرض القوائم المالية','screen','financial_statements','/workspace/financial-statements','reporting',80),
('screen.financial_analysis.view','التحليل المالي','عرض التحليل المالي','screen','financial_analysis','/workspace/financial-analysis','analysis',90),
('screen.budget.view','الميزانية','الوصول إلى الميزانية','screen','budget','/workspace/budget','planning',100),
('screen.forecast.view','التوقعات','الوصول إلى التوقعات','screen','forecast','/workspace/forecast','planning',110),
('screen.variance.view','تحليل الانحرافات','عرض تحليل الانحرافات','screen','variance','/workspace/variance','analysis',120),
('screen.cash.view','التدفق النقدي','الوصول إلى توقعات التدفق النقدي','screen','cash','/workspace/cash','planning',130),
('screen.scenarios.view','السيناريوهات','الوصول إلى السيناريوهات','screen','scenarios','/workspace/scenarios','planning',140),
('screen.dimensions.view','الأبعاد','إدارة وتحليل الأبعاد التشغيلية','screen','dimensions','/workspace/dimensions','data',150),
('screen.reports.view','التقارير','الوصول إلى التقارير','screen','reports','/workspace/reports','reporting',160),
('screen.ai_analyst.view','المحلل المالي الذكي','الوصول إلى المحلل المالي الذكي','screen','ai_analyst','/workspace/ai-analyst','ai',170),
('screen.audit.view','سجل التدقيق','عرض سجل التدقيق','screen','audit','/workspace/audit','administration',180),
('screen.company_profile.view','بيانات الشركة','عرض وإدارة بيانات الشركة','screen','company_profile','/workspace/company-profile','administration',190),
('screen.team.view','فريق العمل','إدارة المستخدمين والفريق','screen','team','/workspace/team','administration',200)
on conflict(permission_key) do update set name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,screen_key=excluded.screen_key,route_path=excluded.route_path,category=excluded.category,sort_order=excluded.sort_order;

insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select om.organization_id,om.user_id,p.permission_key,true
from public.organization_members om
join public.organization_role_permissions rp on rp.organization_id=om.organization_id and rp.role_key=coalesce(om.role_key,'viewer')
join public.organization_permissions p on p.permission_key like 'screen.%'
where om.permissions_initialized=true and rp.permission_key='view'
on conflict (organization_id,user_id,permission_key) do nothing;

insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select om.organization_id,om.user_id,p.permission_key,true
from public.organization_members om
join public.organization_permissions p on p.permission_key like 'screen.%'
where om.permissions_initialized=true and coalesce(om.role_key,'')='company_admin'
on conflict (organization_id,user_id,permission_key) do update set granted=true;

create or replace function public.get_my_org_access(p_organization_id uuid)
returns table(organization_id uuid,user_id uuid,role_key text,hierarchy_level integer,parent_user_id uuid,permissions_initialized boolean,permission_key text,granted boolean,permission_type text,screen_key text,route_path text,category text,permission_name text)
language sql security definer set search_path='' stable as $$
  select om.organization_id,om.user_id,coalesce(om.role_key,'viewer'),coalesce(r.hierarchy_level,0),om.parent_user_id,om.permissions_initialized,p.permission_key,coalesce(po.granted,false),p.permission_type,p.screen_key,p.route_path,p.category,p.name
  from public.organization_members om
  left join public.organization_roles r on r.organization_id=om.organization_id and r.role_key=coalesce(om.role_key,'viewer')
  join public.organization_permissions p on true
  left join public.organization_member_permission_overrides po on po.organization_id=om.organization_id and po.user_id=om.user_id and po.permission_key=p.permission_key
  where om.organization_id=p_organization_id and om.user_id=auth.uid() and om.permissions_initialized=true
  order by p.sort_order,p.permission_key;
$$;
revoke all on function public.get_my_org_access(uuid) from public,anon;
grant execute on function public.get_my_org_access(uuid) to authenticated;

create or replace function public.get_team_members(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.has_org_permission(p_organization_id,'view') then raise exception 'Not authorized'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',om.user_id,'email',u.email,'role',coalesce(om.role,'viewer'),'role_key',coalesce(om.role_key,'viewer'),'hierarchy_level',coalesce(r.hierarchy_level,0),'parent_user_id',om.parent_user_id,'created_at',om.created_at,'manageable',public.can_manage_member(p_organization_id,om.user_id),'overrides',coalesce((select jsonb_object_agg(po.permission_key,po.granted) from public.organization_member_permission_overrides po where po.organization_id=om.organization_id and po.user_id=om.user_id),'{}'::jsonb)) order by om.created_at),'[]'::jsonb) into v_result
  from public.organization_members om join auth.users u on u.id=om.user_id
  left join public.organization_roles r on r.organization_id=om.organization_id and r.role_key=coalesce(om.role_key,'viewer')
  where om.organization_id=p_organization_id;
  return v_result;
end;
$$;
revoke all on function public.get_team_members(uuid) from public,anon;
grant execute on function public.get_team_members(uuid) to authenticated;

create or replace function public.initialize_company_admin_permissions(p_organization_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.organization_members where organization_id=p_organization_id and user_id=auth.uid() and role_key='company_admin') then raise exception 'Not authorized'; end if;
  insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
  select p_organization_id,auth.uid(),rp.permission_key,true from public.organization_role_permissions rp where rp.organization_id=p_organization_id and rp.role_key='company_admin'
  on conflict (organization_id,user_id,permission_key) do update set granted=true;
  insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
  select p_organization_id,auth.uid(),p.permission_key,true from public.organization_permissions p where p.permission_type='screen'
  on conflict (organization_id,user_id,permission_key) do update set granted=true;
  update public.organization_members set permissions_initialized=true where organization_id=p_organization_id and user_id=auth.uid();
  return true;
end;
$$;
revoke all on function public.initialize_company_admin_permissions(uuid) from public,anon;
grant execute on function public.initialize_company_admin_permissions(uuid) to authenticated;

-- Keep login rate-limit RPCs callable before authentication. Other SECURITY DEFINER RPCs
-- are explicitly limited to authenticated clients.
do $$ declare r record; begin
  for r in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef=true and p.proname not in ('check_login_rate_limit','record_login_failure','clear_login_failures') loop
    execute format('revoke execute on function %s from public, anon', r.fn);
    execute format('grant execute on function %s to authenticated', r.fn);
  end loop;
end $$;
