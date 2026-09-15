-- Activity-driven company reporting profiles.
-- The activity is mandatory for new workspaces and deterministically selects the
-- reporting template/profile stored in organization_reporting_preferences.

create table public.financial_activities (
  activity_key text primary key,
  name_ar text not null,
  name_en text not null,
  description_ar text,
  default_template_key text not null,
  reporting_profile jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

alter table public.financial_activities enable row level security;
create policy "financial activities are readable by authenticated users"
  on public.financial_activities for select to authenticated using (is_active = true);
grant select on public.financial_activities to authenticated;

insert into public.financial_activities
  (activity_key,name_ar,name_en,description_ar,default_template_key,reporting_profile,sort_order)
values
('trading','التجارة والتوزيع','Trading & Distribution','نشاط بيع وشراء السلع وتوزيعها مع إبراز المخزون وتكلفة البضاعة المباعة ومجمل الربح.','trading','{"revenue_label":"المبيعات","cost_label":"تكلفة البضاعة المباعة","inventory_focus":true,"operating_expense_presentation":"by_function","special_sections":["gross_profit","selling_distribution_expenses","administrative_expenses"]}',10),
('contracting','المقاولات والإنشاءات','Contracting & Construction','نشاط العقود والمشروعات مع إبراز إيرادات العقود وتكاليف المشاريع والأعمال تحت التنفيذ.','contracting','{"revenue_label":"إيرادات العقود والمشروعات","cost_label":"تكاليف العقود والمشروعات","wip_focus":true,"operating_expense_presentation":"by_function","special_sections":["contract_revenue","contract_costs","work_in_progress","contract_assets_liabilities"]}',20),
('restaurant','المطاعم والمقاهي','Restaurants & Cafes','نشاط الأغذية والمشروبات مع إبراز تكلفة الأغذية والمشروبات وهوامش التشغيل.','restaurant','{"revenue_label":"إيرادات الأغذية والمشروبات","cost_label":"تكلفة الأغذية والمشروبات","inventory_focus":true,"operating_expense_presentation":"by_function","special_sections":["food_beverage_cost","delivery_commissions","store_operating_expenses"]}',30),
('manufacturing','التصنيع','Manufacturing','نشاط صناعي مع إبراز المواد الخام والإنتاج تحت التشغيل والمنتجات التامة وتكلفة التصنيع.','manufacturing','{"revenue_label":"إيرادات المبيعات","cost_label":"تكلفة المبيعات والتصنيع","inventory_focus":true,"operating_expense_presentation":"by_function","special_sections":["raw_materials","work_in_progress","finished_goods","manufacturing_overheads","cost_of_production"]}',40),
('services','الخدمات والاستشارات','Services & Consulting','نشاط خدمي يركز على إيرادات الخدمات وتكاليف تقديم الخدمة والموارد التشغيلية.','services','{"revenue_label":"إيرادات الخدمات","cost_label":"تكاليف تقديم الخدمات","inventory_focus":false,"operating_expense_presentation":"by_function","special_sections":["service_delivery_costs","personnel_costs","administrative_expenses"]}',50),
('technology','التقنية والبرمجيات','Technology & Software','نشاط تقني وبرمجي مع إبراز الإيرادات المتكررة والتكاليف التقنية والتطوير عند انطباق المعالجة.','technology','{"revenue_label":"إيرادات البرمجيات والخدمات التقنية","cost_label":"تكلفة الخدمات والتقنية","inventory_focus":false,"operating_expense_presentation":"by_function","special_sections":["recurring_revenue","hosting_costs","development_costs","research_development"]}',60),
('real_estate','العقارات','Real Estate','نشاط عقاري مع إبراز عقارات الاستثمار والمخزون العقاري وإيرادات الإيجار أو البيع بحسب طبيعة النشاط.','real_estate','{"revenue_label":"إيرادات النشاط العقاري","cost_label":"تكلفة المبيعات العقارية","operating_expense_presentation":"by_function","special_sections":["rental_income","investment_property","property_inventory","property_costs"]}',70),
('healthcare','الرعاية الصحية','Healthcare','نشاط صحي يركز على إيرادات الخدمات الطبية وتكاليف تقديم الرعاية والمصروفات التشغيلية.','healthcare','{"revenue_label":"إيرادات الخدمات الطبية","cost_label":"تكلفة الخدمات الطبية","operating_expense_presentation":"by_function","special_sections":["medical_service_revenue","medical_supplies","clinical_personnel","facility_costs"]}',80),
('education','التعليم والتدريب','Education & Training','نشاط تعليمي يركز على الرسوم والإيرادات التعليمية وتكاليف تقديم البرامج.','education','{"revenue_label":"الإيرادات التعليمية","cost_label":"تكلفة البرامج التعليمية","operating_expense_presentation":"by_function","special_sections":["tuition_revenue","program_costs","academic_personnel","facility_costs"]}',90),
('logistics','النقل واللوجستيات','Transport & Logistics','نشاط نقل ولوجستيات مع إبراز إيرادات النقل وتكاليف الأسطول والتشغيل.','logistics','{"revenue_label":"إيرادات النقل والخدمات اللوجستية","cost_label":"تكاليف النقل والتشغيل","operating_expense_presentation":"by_function","special_sections":["fleet_costs","fuel_costs","delivery_costs","logistics_revenue"]}',100),
('agriculture','الزراعة والإنتاج الزراعي','Agriculture','نشاط زراعي مع مراعاة طبيعة المحاصيل والإنتاج الزراعي والمخزون والتكاليف المرتبطة به.','agriculture','{"revenue_label":"إيرادات المنتجات الزراعية","cost_label":"تكلفة الإنتاج الزراعي","operating_expense_presentation":"by_function","special_sections":["biological_assets","agricultural_inventory","production_costs"]}',110),
('finance','التمويل والخدمات المالية','Finance & Financial Services','نشاط مالي يحتاج إلى عرض وتصنيف متخصص بحسب طبيعة التمويل والأدوات المالية والنتائج من النشاط الرئيسي.','finance','{"revenue_label":"إيرادات النشاط المالي","cost_label":"تكاليف التمويل والنشاط المالي","operating_expense_presentation":"by_nature","special_sections":["finance_income","finance_costs","financial_instruments","credit_impairment"]}',120),
('investment','الاستثمار وإدارة الأصول','Investment & Asset Management','نشاط استثماري يبرز دخل الاستثمار ونتائج الأدوات والاستثمارات وفق طبيعة النشاط الرئيسي.','investment','{"revenue_label":"إيرادات الاستثمار","cost_label":"تكاليف الاستثمار","operating_expense_presentation":"by_nature","special_sections":["investment_income","fair_value_movements","finance_costs"]}',130),
('generic','نشاط عام / غير محدد','General / Other','قالب عام عند عدم وجود نشاط متخصص.','standard','{"revenue_label":"الإيرادات","cost_label":"تكلفة المبيعات أو الخدمات","operating_expense_presentation":"by_function","special_sections":["gross_profit","operating_expenses"]}',999);

alter table public.organizations add column activity_key text;
update public.organizations set activity_key='trading', industry='التجارة والتوزيع'
where lower(coalesce(industry,'')) in ('التجاري','تجارة','تجارة وتوزيع');
update public.organizations set activity_key='generic' where activity_key is null;
alter table public.organizations
  add constraint organizations_activity_key_fkey
  foreign key(activity_key) references public.financial_activities(activity_key);
alter table public.organizations alter column activity_key set not null;

update public.financial_statement_templates
set activity_key='services',
    config=jsonb_set(coalesce(config,'{}'::jsonb),'{presentation_profile}','"services"'::jsonb)
where template_key='services' and organization_id is null;

insert into public.financial_statement_templates
  (template_key,name_ar,name_en,activity_key,description_ar,config,is_system,is_active)
select v.template_key,v.name_ar,v.name_en,v.activity_key,v.description_ar,v.config,true,true
from (values
('services','قالب الخدمات والاستشارات','Services & Consulting','services','قائمة تبرز إيرادات الخدمات وتكاليف تقديم الخدمة والمصروفات التشغيلية.','{"sections":["income","balance_sheet","cash_flow","equity"],"show_kpis":true,"show_details":true,"presentation_profile":"services"}'::jsonb),
('manufacturing','قالب التصنيع','Manufacturing','manufacturing','قائمة تبرز المواد الخام والإنتاج تحت التشغيل والمنتجات التامة وتكلفة التصنيع.','{"sections":["income","balance_sheet","cash_flow","equity"],"show_kpis":true,"show_details":true,"presentation_profile":"manufacturing"}'::jsonb),
('technology','قالب التقنية والبرمجيات','Technology & Software','technology','قائمة تبرز الإيرادات التقنية والتكاليف المباشرة والتطوير والاستضافة عند انطباق المعالجة.','{"sections":["income","balance_sheet","cash_flow","equity"],"show_kpis":true,"show_details":true,"presentation_profile":"technology"}'::jsonb),
('real_estate','قالب العقارات','Real Estate','real_estate','قائمة تبرز الإيرادات العقارية وعقارات الاستثمار والمخزون العقاري بحسب طبيعة النشاط.','{"sections":["income","balance_sheet","cash_flow","equity"],"show_kpis":true,"show_details":true,"presentation_profile":"real_estate"}'::jsonb),
('healthcare','قالب الرعاية الصحية','Healthcare','healthcare','قائمة تبرز إيرادات الخدمات الطبية وتكاليف تقديم الرعاية.','{"sections":["income","balance_sheet","cash_flow","equity"],"show_kpis":true,"show_details":true,"presentation_profile":"healthcare"}'::jsonb),
('education','قالب التعليم والتدريب','Education & Training','education','قائمة تبرز الإيرادات التعليمية وتكاليف البرامج.','{"sections":["income","balance_sheet","cash_flow","equity"],"show_kpis":true,"show_details":true,"presentation_profile":"education"}'::jsonb),
('logistics','قالب النقل واللوجستيات','Transport & Logistics','logistics','قائمة تبرز إيرادات النقل وتكاليف الأسطول والوقود والتشغيل.','{"sections":["income","balance_sheet","cash_flow","equity"],"show_kpis":true,"show_details":true,"presentation_profile":"logistics"}'::jsonb),
('agriculture','قالب الزراعة','Agriculture','agriculture','قائمة تبرز الإنتاج الزراعي والمخزون والأصول الحيوية عند انطباق المعالجة.','{"sections":["income","balance_sheet","cash_flow","equity"],"show_kpis":true,"show_details":true,"presentation_profile":"agriculture"}'::jsonb),
('finance','قالب الخدمات المالية','Finance & Financial Services','finance','قائمة متخصصة لنشاط التمويل والخدمات المالية.','{"sections":["income","balance_sheet","cash_flow","equity"],"show_kpis":true,"show_details":true,"presentation_profile":"finance"}'::jsonb),
('investment','قالب الاستثمار وإدارة الأصول','Investment & Asset Management','investment','قائمة متخصصة لنشاط الاستثمار وإدارة الأصول.','{"sections":["income","balance_sheet","cash_flow","equity"],"show_kpis":true,"show_details":true,"presentation_profile":"investment"}'::jsonb)
) v(template_key,name_ar,name_en,activity_key,description_ar,config)
where not exists(select 1 from public.financial_statement_templates x where x.organization_id is null and x.template_key=v.template_key);

insert into public.organization_reporting_preferences(organization_id,template_key,cash_flow_method,custom_config)
select o.id,fa.default_template_key,'indirect',jsonb_build_object('activity_key',fa.activity_key,'reporting_profile',fa.reporting_profile)
from public.organizations o join public.financial_activities fa on fa.activity_key=o.activity_key
on conflict(organization_id) do update
set template_key=excluded.template_key,custom_config=excluded.custom_config,updated_at=now();

create function public.get_financial_activities()
returns table(activity_key text,name_ar text,name_en text,description_ar text,default_template_key text,reporting_profile jsonb)
language sql stable security invoker set search_path='public','pg_catalog'
as $$
  select activity_key,name_ar,name_en,description_ar,default_template_key,reporting_profile
  from public.financial_activities where is_active=true order by sort_order,name_ar;
$$;
grant execute on function public.get_financial_activities() to authenticated;

-- Recreate workspace creation so activity is mandatory and template selection is server-side.
drop function if exists public.create_workspace(text,text,smallint,jsonb,uuid);
create function public.create_workspace(p_name text,p_base_currency text,p_fiscal_year_start_month smallint,p_company_profile jsonb,p_parent_organization_id uuid,p_activity_key text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare new_organization_id uuid; new_slug text; v_name text; v_currency text; v_month smallint; v_source text; v_parent uuid; v_activity text; v_activity_name text; v_template text; v_profile jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 v_name:=coalesce(nullif(trim(p_name),''),'مؤسسة جديدة'); if length(v_name)>120 then raise exception 'Workspace name must not exceed 120 characters'; end if;
 v_currency:=upper(coalesce(nullif(trim(p_base_currency),''),'SAR')); if v_currency !~ '^[A-Z]{3}$' then raise exception 'Base currency must be a three-letter ISO code'; end if;
 v_month:=coalesce(p_fiscal_year_start_month,1); if v_month<1 or v_month>12 then raise exception 'Fiscal year start month must be between 1 and 12'; end if;
 v_activity:=lower(nullif(trim(p_activity_key),''));
 if v_activity is null or v_activity='generic' or not exists(select 1 from public.financial_activities where activity_key=v_activity and is_active) then raise exception 'Company activity is required'; end if;
 select name_ar,default_template_key,reporting_profile into v_activity_name,v_template,v_profile from public.financial_activities where activity_key=v_activity;
 v_parent:=p_parent_organization_id;
 if v_parent is not null then
   if not exists(select 1 from public.organization_members om where om.organization_id=v_parent and om.user_id=auth.uid()) then raise exception 'You are not a member of the parent company'; end if;
   if not public.has_org_permission(v_parent,'manage_settings') then raise exception 'You do not have permission to add a subsidiary company'; end if;
 end if;
 v_source:=nullif(trim(p_company_profile ->> 'initial_data_source'),''); if v_source is not null and v_source not in ('excel','manual','integration') then raise exception 'Initial data source is invalid'; end if;
 new_slug:=regexp_replace(lower(v_name),'[^[:alnum:]]+','-','g'); new_slug:=trim(both '-' from new_slug); if new_slug='' then new_slug:='workspace'; end if; new_slug:=left(new_slug,70)||'-'||left(replace(gen_random_uuid()::text,'-',''),8);
 insert into public.organizations(name,slug,base_currency,fiscal_year_start_month,parent_organization_id,legal_name,country,city,address,industry,activity_key,company_size,tax_id,registration_number,website,contact_email,contact_phone,initial_data_source)
 values(v_name,new_slug,v_currency,v_month,v_parent,nullif(trim(p_company_profile ->> 'legal_name'),''),nullif(trim(p_company_profile ->> 'country'),''),nullif(trim(p_company_profile ->> 'city'),''),nullif(trim(p_company_profile ->> 'address'),''),v_activity_name,v_activity,nullif(trim(p_company_profile ->> 'company_size'),''),nullif(trim(p_company_profile ->> 'tax_id'),''),nullif(trim(p_company_profile ->> 'registration_number'),''),nullif(trim(p_company_profile ->> 'website'),''),nullif(trim(p_company_profile ->> 'contact_email'),''),nullif(trim(p_company_profile ->> 'contact_phone'),''),v_source) returning id into new_organization_id;
 insert into public.organization_reporting_preferences(organization_id,template_key,cash_flow_method,custom_config) values(new_organization_id,v_template,'indirect',jsonb_build_object('activity_key',v_activity,'reporting_profile',v_profile));
 insert into public.organization_members(organization_id,user_id,role,role_key,parent_user_id,permissions_initialized) values(new_organization_id,auth.uid(),'admin','company_admin',null,true);
 insert into public.organization_roles(organization_id,role_key,name,description) select new_organization_id,r.role_key,r.name,r.description from (values ('company_admin','مسؤول الشركة','إدارة مساحة العمل والمستخدمين والإعدادات والصلاحيات'),('ceo','الرئيس التنفيذي','الرؤية التنفيذية والقرارات'),('cfo','المدير المالي','التخطيط المالي والمراجعة والاعتماد والتقارير'),('finance_manager','مدير مالي','التخطيط والتوقعات والتحليل والتقارير'),('fpa_analyst','محلل FP&A','النماذج والتوقعات والسيناريوهات والتحليل'),('accountant','محاسب','البيانات الفعلية والاستيراد والمطابقات والتعديلات'),('department_manager','مدير قسم','إدخالات القسم والأداء'),('sales_manager','مدير مبيعات','افتراضات المبيعات والمحركات التشغيلية'),('hr_manager','مدير الموارد البشرية','افتراضات القوى العاملة والموظفين'),('procurement_manager','مدير المشتريات','افتراضات المشتريات والتكاليف'),('operations_manager','مدير العمليات','المحركات والافتراضات التشغيلية'),('viewer','مطلع','عرض البيانات المسموح بها'),('board','مجلس الإدارة','الاعتماد والاطلاع التنفيذي')) as r(role_key,name,description) on conflict(organization_id,role_key) do nothing;
 insert into public.organization_role_permissions(organization_id,role_key,permission_key) select new_organization_id,rp.role_key,rp.permission_key from (values ('company_admin','view'),('company_admin','create'),('company_admin','edit'),('company_admin','delete'),('company_admin','import'),('company_admin','export'),('company_admin','submit'),('company_admin','approve'),('company_admin','reject'),('company_admin','lock'),('company_admin','manage_users'),('company_admin','manage_settings'),('company_admin','manage_budget'),('company_admin','manage_forecast'),('company_admin','manage_scenarios'),('company_admin','access_ai'),('ceo','view'),('ceo','export'),('ceo','approve'),('ceo','access_ai'),('cfo','view'),('cfo','create'),('cfo','edit'),('cfo','export'),('cfo','submit'),('cfo','approve'),('cfo','reject'),('cfo','lock'),('cfo','manage_budget'),('cfo','manage_forecast'),('cfo','manage_scenarios'),('cfo','access_ai'),('finance_manager','view'),('finance_manager','create'),('finance_manager','edit'),('finance_manager','export'),('finance_manager','submit'),('finance_manager','manage_budget'),('finance_manager','manage_forecast'),('finance_manager','manage_scenarios'),('finance_manager','access_ai'),('fpa_analyst','view'),('fpa_analyst','create'),('fpa_analyst','edit'),('fpa_analyst','export'),('fpa_analyst','submit'),('fpa_analyst','manage_budget'),('fpa_analyst','manage_forecast'),('fpa_analyst','manage_scenarios'),('fpa_analyst','access_ai'),('accountant','view'),('accountant','create'),('accountant','edit'),('accountant','import'),('accountant','export'),('accountant','submit'),('department_manager','view'),('department_manager','create'),('department_manager','edit'),('department_manager','submit'),('sales_manager','view'),('sales_manager','create'),('sales_manager','edit'),('sales_manager','submit'),('hr_manager','view'),('hr_manager','create'),('hr_manager','edit'),('hr_manager','submit'),('procurement_manager','view'),('procurement_manager','create'),('procurement_manager','edit'),('procurement_manager','submit'),('operations_manager','view'),('operations_manager','create'),('operations_manager','edit'),('operations_manager','submit'),('viewer','view')) as rp(role_key,permission_key) where exists(select 1 from public.organization_permissions p where p.permission_key=rp.permission_key) on conflict do nothing;
 insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted) select new_organization_id,auth.uid(),p.permission_key,true from public.organization_permissions p where p.permission_type='screen' or p.permission_key in (select permission_key from public.organization_role_permissions where organization_id=new_organization_id and role_key='company_admin') on conflict(organization_id,user_id,permission_key) do update set granted=true;
 return new_organization_id;
end;$function$;
grant execute on function public.create_workspace(text,text,smallint,jsonb,uuid,text) to authenticated;

-- Editing a company also changes its reporting profile atomically.
drop function if exists public.get_workspace_profile(uuid);
create function public.get_workspace_profile(p_organization_id uuid)
returns table(id uuid,name text,legal_name text,industry text,city text,base_currency text,fiscal_year_start_month smallint,activity_key text,activity_name_ar text,template_key text)
language plpgsql stable security definer set search_path='public','pg_catalog'
as $$ begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if not public.has_org_permission(p_organization_id,'manage_settings') then raise exception 'FORBIDDEN'; end if;
 return query select o.id,o.name,o.legal_name,o.industry,o.city,o.base_currency,o.fiscal_year_start_month,o.activity_key,fa.name_ar,coalesce(rp.template_key,fa.default_template_key)
 from public.organizations o join public.financial_activities fa on fa.activity_key=o.activity_key left join public.organization_reporting_preferences rp on rp.organization_id=o.id where o.id=p_organization_id;
 if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
end; $$;
grant execute on function public.get_workspace_profile(uuid) to authenticated;

drop function if exists public.update_workspace_profile(uuid,text,text,text,text,text,smallint);
create function public.update_workspace_profile(p_organization_id uuid,p_name text,p_legal_name text,p_industry text,p_city text,p_base_currency text,p_fiscal_year_start_month smallint,p_activity_key text)
returns boolean language plpgsql security definer set search_path='public','pg_catalog'
as $$ declare v_activity text;v_template text;v_profile jsonb;v_activity_name text;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if not public.has_org_permission(p_organization_id,'manage_settings') then raise exception 'FORBIDDEN'; end if;
 if nullif(btrim(p_name),'') is null then raise exception 'COMPANY_NAME_REQUIRED'; end if;
 if p_base_currency not in ('SAR','AED','USD','EGP') then raise exception 'INVALID_CURRENCY'; end if;
 if p_fiscal_year_start_month<1 or p_fiscal_year_start_month>12 then raise exception 'INVALID_FISCAL_MONTH'; end if;
 v_activity:=lower(nullif(btrim(p_activity_key),'')); if v_activity is null or v_activity='generic' or not exists(select 1 from public.financial_activities where activity_key=v_activity and is_active) then raise exception 'COMPANY_ACTIVITY_REQUIRED'; end if;
 select default_template_key,reporting_profile,name_ar into v_template,v_profile,v_activity_name from public.financial_activities where activity_key=v_activity;
 update public.organizations set name=btrim(p_name),legal_name=nullif(btrim(coalesce(p_legal_name,'')),''),industry=coalesce(nullif(btrim(coalesce(p_industry,'')),''),v_activity_name),city=nullif(btrim(coalesce(p_city,'')),''),base_currency=p_base_currency,fiscal_year_start_month=p_fiscal_year_start_month,activity_key=v_activity,updated_at=now() where id=p_organization_id;
 if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
 insert into public.organization_reporting_preferences(organization_id,template_key,cash_flow_method,custom_config) values(p_organization_id,v_template,'indirect',jsonb_build_object('activity_key',v_activity,'reporting_profile',v_profile)) on conflict(organization_id) do update set template_key=excluded.template_key,custom_config=excluded.custom_config,updated_at=now();
 return true;
end; $$;
grant execute on function public.update_workspace_profile(uuid,text,text,text,text,text,smallint,text) to authenticated;
