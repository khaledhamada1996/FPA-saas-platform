-- Identity & Access foundation from docs/03-users-permissions.md.
-- Roles are templates; effective access is permission + organization scope.

alter table public.organization_members add column if not exists role_key text;

update public.organization_members
set role_key = case role
  when 'owner' then 'company_admin'
  when 'admin' then 'company_admin'
  when 'planner' then 'fpa_analyst'
  when 'viewer' then 'viewer'
  else 'viewer'
end
where role_key is null;

create table if not exists public.organization_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_key text not null,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, role_key)
);

create table if not exists public.organization_permissions (
  permission_key text primary key,
  name text not null,
  description text
);

create table if not exists public.organization_role_permissions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role_key text not null,
  permission_key text not null references public.organization_permissions(permission_key) on delete cascade,
  primary key (organization_id, role_key, permission_key),
  foreign key (organization_id, role_key) references public.organization_roles(organization_id, role_key) on delete cascade
);

create table if not exists public.organization_member_permission_overrides (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null references public.organization_permissions(permission_key) on delete cascade,
  granted boolean not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id, permission_key)
);

create table if not exists public.organization_member_scopes (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_type text not null check (scope_type in ('organization','legal_entity','branch','department','cost_center','region','product','project')),
  scope_id uuid,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id, scope_type, scope_id)
);

insert into public.organization_permissions (permission_key, name, description) values
('view','عرض','عرض البيانات والوحدات المسموح بها'),('create','إنشاء','إنشاء سجلات أو نسخ جديدة'),('edit','تعديل','تعديل البيانات أو الافتراضات'),('delete','حذف','حذف السجلات المسموح بها'),('import','استيراد','رفع واستيراد البيانات'),('export','تصدير','تصدير البيانات والتقارير'),('submit','إرسال','إرسال نسخة للمراجعة'),('approve','اعتماد','اعتماد الميزانيات والتوقعات والنسخ'),('reject','رفض','رفض نسخة أو طلب'),('lock','قفل','قفل فترة أو نسخة'),('manage_users','إدارة المستخدمين','دعوة المستخدمين وإدارة عضويتهم'),('manage_settings','إدارة الإعدادات','تعديل إعدادات الشركة'),('manage_budget','إدارة الميزانية','إدارة الميزانيات وافتراضاتها'),('manage_forecast','إدارة التوقعات','إدارة التوقعات وإصداراتها'),('manage_scenarios','إدارة السيناريوهات','إنشاء وتعديل السيناريوهات'),('access_ai','الوصول للمحلل المالي الذكي','استخدام AI Financial Analyst')
on conflict (permission_key) do update set name=excluded.name, description=excluded.description;

insert into public.organization_roles (organization_id, role_key, name, description)
select o.id, r.role_key, r.name, r.description
from public.organizations o
cross join (values
('company_admin','مسؤول الشركة','إدارة مساحة العمل والمستخدمين والإعدادات والصلاحيات'),('ceo','الرئيس التنفيذي','الرؤية التنفيذية والقرارات'),('cfo','المدير المالي','التخطيط المالي والمراجعة والاعتماد والتقارير'),('finance_manager','مدير مالي','التخطيط والتوقعات والتحليل والتقارير'),('fpa_analyst','محلل FP&A','النماذج والتوقعات والسيناريوهات والتحليل'),('accountant','محاسب','البيانات الفعلية والاستيراد والمطابقات والتعديلات'),('department_manager','مدير قسم','إدخالات القسم والأداء'),('sales_manager','مدير مبيعات','افتراضات المبيعات والمحركات التشغيلية'),('hr_manager','مدير الموارد البشرية','افتراضات القوى العاملة والموظفين'),('procurement_manager','مدير المشتريات','افتراضات المشتريات والتكاليف'),('operations_manager','مدير العمليات','المحركات والافتراضات التشغيلية'),('viewer','مطلع','عرض البيانات المسموح بها')
) as r(role_key,name,description)
on conflict (organization_id, role_key) do update set name=excluded.name, description=excluded.description;

insert into public.organization_role_permissions (organization_id, role_key, permission_key)
select o.id, r.role_key, p.permission_key
from public.organizations o
cross join (values
('company_admin','view'),('company_admin','create'),('company_admin','edit'),('company_admin','delete'),('company_admin','import'),('company_admin','export'),('company_admin','submit'),('company_admin','approve'),('company_admin','reject'),('company_admin','lock'),('company_admin','manage_users'),('company_admin','manage_settings'),('company_admin','manage_budget'),('company_admin','manage_forecast'),('company_admin','manage_scenarios'),('company_admin','access_ai'),
('ceo','view'),('ceo','export'),('ceo','approve'),('ceo','access_ai'),('cfo','view'),('cfo','create'),('cfo','edit'),('cfo','export'),('cfo','submit'),('cfo','approve'),('cfo','reject'),('cfo','lock'),('cfo','manage_budget'),('cfo','manage_forecast'),('cfo','manage_scenarios'),('cfo','access_ai'),
('finance_manager','view'),('finance_manager','create'),('finance_manager','edit'),('finance_manager','export'),('finance_manager','submit'),('finance_manager','manage_budget'),('finance_manager','manage_forecast'),('finance_manager','manage_scenarios'),('finance_manager','access_ai'),('fpa_analyst','view'),('fpa_analyst','create'),('fpa_analyst','edit'),('fpa_analyst','export'),('fpa_analyst','submit'),('fpa_analyst','manage_budget'),('fpa_analyst','manage_forecast'),('fpa_analyst','manage_scenarios'),('fpa_analyst','access_ai'),
('accountant','view'),('accountant','create'),('accountant','edit'),('accountant','import'),('accountant','export'),('accountant','submit'),('department_manager','view'),('department_manager','create'),('department_manager','edit'),('department_manager','submit'),('sales_manager','view'),('sales_manager','create'),('sales_manager','edit'),('sales_manager','submit'),('hr_manager','view'),('hr_manager','create'),('hr_manager','edit'),('hr_manager','submit'),('procurement_manager','view'),('procurement_manager','create'),('procurement_manager','edit'),('procurement_manager','submit'),('operations_manager','view'),('operations_manager','create'),('operations_manager','edit'),('operations_manager','submit'),('viewer','view')
) as r(role_key,permission_key)
join public.organization_permissions p on p.permission_key=r.permission_key
on conflict do nothing;

create or replace function public.has_org_permission(p_organization_id uuid, p_permission_key text)
returns boolean language sql security definer set search_path=public stable as $$
  select exists (
    select 1 from public.organization_members om
    join public.organization_role_permissions rp on rp.organization_id=om.organization_id and rp.role_key=coalesce(om.role_key, case om.role when 'admin' then 'company_admin' when 'planner' then 'fpa_analyst' when 'owner' then 'company_admin' else 'viewer' end) and rp.permission_key=p_permission_key
    where om.organization_id=p_organization_id and om.user_id=auth.uid()
  ) or exists (
    select 1 from public.organization_member_permission_overrides po
    where po.organization_id=p_organization_id and po.user_id=auth.uid() and po.permission_key=p_permission_key and po.granted=true
  );
$$;

revoke all on function public.has_org_permission(uuid,text) from public;
grant execute on function public.has_org_permission(uuid,text) to authenticated;

alter table public.organization_roles enable row level security;
alter table public.organization_permissions enable row level security;
alter table public.organization_role_permissions enable row level security;
alter table public.organization_member_permission_overrides enable row level security;
alter table public.organization_member_scopes enable row level security;

create policy organization_roles_member_select on public.organization_roles for select to authenticated using (exists (select 1 from public.organization_members om where om.organization_id=organization_roles.organization_id and om.user_id=auth.uid()));
create policy organization_permissions_authenticated_select on public.organization_permissions for select to authenticated using (true);
create policy organization_role_permissions_member_select on public.organization_role_permissions for select to authenticated using (exists (select 1 from public.organization_members om where om.organization_id=organization_role_permissions.organization_id and om.user_id=auth.uid()));
create policy organization_member_permission_overrides_select on public.organization_member_permission_overrides for select to authenticated using (public.has_org_permission(organization_id,'manage_users') or user_id=auth.uid());
create policy organization_member_scopes_member_select on public.organization_member_scopes for select to authenticated using (exists (select 1 from public.organization_members om where om.organization_id=organization_member_scopes.organization_id and om.user_id=auth.uid()));
