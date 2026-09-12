-- Keep company creation and initial administrator access in one transaction.
-- The function validates parent-company authority server-side and grants the creator
-- explicit company-admin action permissions plus all screen permissions before return.

create or replace function public.create_workspace(p_name text default null,p_base_currency text default 'SAR',p_fiscal_year_start_month smallint default 1,p_company_profile jsonb default '{}'::jsonb,p_parent_organization_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_organization_id uuid; new_slug text; v_name text; v_currency text; v_month smallint; v_source text; v_parent uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_name:=coalesce(nullif(trim(p_name),''),'مؤسسة جديدة');
  if length(v_name)>120 then raise exception 'Workspace name must not exceed 120 characters'; end if;
  v_currency:=upper(coalesce(nullif(trim(p_base_currency),''),'SAR'));
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'Base currency must be a three-letter ISO code'; end if;
  v_month:=coalesce(p_fiscal_year_start_month,1);
  if v_month<1 or v_month>12 then raise exception 'Fiscal year start month must be between 1 and 12'; end if;
  v_parent:=p_parent_organization_id;
  if v_parent is not null then
    if not exists(select 1 from public.organization_members om where om.organization_id=v_parent and om.user_id=auth.uid()) then raise exception 'You are not a member of the parent company'; end if;
    if not public.has_org_permission(v_parent,'manage_settings') then raise exception 'You do not have permission to add a subsidiary company'; end if;
  end if;
  v_source:=nullif(trim(p_company_profile ->> 'initial_data_source'),'');
  if v_source is not null and v_source not in ('excel','manual','integration') then raise exception 'Initial data source is invalid'; end if;
  new_slug:=regexp_replace(lower(v_name),'[^[:alnum:]]+','-','g'); new_slug:=trim(both '-' from new_slug); if new_slug='' then new_slug:='workspace'; end if; new_slug:=left(new_slug,70)||'-'||left(replace(gen_random_uuid()::text,'-',''),8);
  insert into public.organizations(name,slug,base_currency,fiscal_year_start_month,parent_organization_id,legal_name,country,city,address,industry,company_size,tax_id,registration_number,website,contact_email,contact_phone,initial_data_source)
  values(v_name,new_slug,v_currency,v_month,v_parent,nullif(trim(p_company_profile ->> 'legal_name'),''),nullif(trim(p_company_profile ->> 'country'),''),nullif(trim(p_company_profile ->> 'city'),''),nullif(trim(p_company_profile ->> 'address'),''),nullif(trim(p_company_profile ->> 'industry'),''),nullif(trim(p_company_profile ->> 'company_size'),''),nullif(trim(p_company_profile ->> 'tax_id'),''),nullif(trim(p_company_profile ->> 'registration_number'),''),nullif(trim(p_company_profile ->> 'website'),''),nullif(trim(p_company_profile ->> 'contact_email'),''),nullif(trim(p_company_profile ->> 'contact_phone'),''),v_source)
  returning id into new_organization_id;
  insert into public.organization_members(organization_id,user_id,role,role_key,parent_user_id,permissions_initialized) values(new_organization_id,auth.uid(),'admin','company_admin',null,true);
  insert into public.organization_roles(organization_id,role_key,name,description)
  select new_organization_id,r.role_key,r.name,r.description from (values
    ('company_admin','مسؤول الشركة','إدارة مساحة العمل والمستخدمين والإعدادات والصلاحيات'),('ceo','الرئيس التنفيذي','الرؤية التنفيذية والقرارات'),('cfo','المدير المالي','التخطيط المالي والمراجعة والاعتماد والتقارير'),('finance_manager','مدير مالي','التخطيط والتوقعات والتحليل والتقارير'),('fpa_analyst','محلل FP&A','النماذج والتوقعات والسيناريوهات والتحليل'),('accountant','محاسب','البيانات الفعلية والاستيراد والمطابقات والتعديلات'),('department_manager','مدير قسم','إدخالات القسم والأداء'),('sales_manager','مدير مبيعات','افتراضات المبيعات والمحركات التشغيلية'),('hr_manager','مدير الموارد البشرية','افتراضات القوى العاملة والموظفين'),('procurement_manager','مدير المشتريات','المشتريات والتكاليف'),('operations_manager','مدير العمليات','المحركات التشغيلية'),('viewer','مطلع','عرض البيانات المسموح بها'),('board','مجلس الإدارة','الاعتماد والاطلاع التنفيذي')) as r(role_key,name,description) on conflict(organization_id,role_key) do nothing;
  insert into public.organization_role_permissions(organization_id,role_key,permission_key)
  select new_organization_id,rp.role_key,rp.permission_key from (values
    ('company_admin','view'),('company_admin','create'),('company_admin','edit'),('company_admin','delete'),('company_admin','import'),('company_admin','export'),('company_admin','submit'),('company_admin','approve'),('company_admin','reject'),('company_admin','lock'),('company_admin','manage_users'),('company_admin','manage_settings'),('company_admin','manage_budget'),('company_admin','manage_forecast'),('company_admin','manage_scenarios'),('company_admin','access_ai'),('ceo','view'),('ceo','export'),('ceo','approve'),('ceo','access_ai'),('cfo','view'),('cfo','create'),('cfo','edit'),('cfo','export'),('cfo','submit'),('cfo','approve'),('cfo','reject'),('cfo','lock'),('cfo','manage_budget'),('cfo','manage_forecast'),('cfo','manage_scenarios'),('cfo','access_ai'),('finance_manager','view'),('finance_manager','create'),('finance_manager','edit'),('finance_manager','export'),('finance_manager','submit'),('finance_manager','manage_budget'),('finance_manager','manage_forecast'),('finance_manager','manage_scenarios'),('finance_manager','access_ai'),('fpa_analyst','view'),('fpa_analyst','create'),('fpa_analyst','edit'),('fpa_analyst','export'),('fpa_analyst','submit'),('fpa_analyst','manage_budget'),('fpa_analyst','manage_forecast'),('fpa_analyst','manage_scenarios'),('fpa_analyst','access_ai'),('accountant','view'),('accountant','create'),('accountant','edit'),('accountant','import'),('accountant','export'),('accountant','submit'),('viewer','view')) as rp(role_key,permission_key) where exists(select 1 from public.organization_permissions p where p.permission_key=rp.permission_key) on conflict do nothing;
  insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
  select new_organization_id,auth.uid(),p.permission_key,true from public.organization_permissions p where p.permission_type='screen' or p.permission_key in(select permission_key from public.organization_role_permissions where organization_id=new_organization_id and role_key='company_admin') on conflict(organization_id,user_id,permission_key) do update set granted=true;
  return new_organization_id;
end;
$$;
revoke all on function public.create_workspace(text,text,smallint,jsonb,uuid) from public,anon;
grant execute on function public.create_workspace(text,text,smallint,jsonb,uuid) to authenticated;
