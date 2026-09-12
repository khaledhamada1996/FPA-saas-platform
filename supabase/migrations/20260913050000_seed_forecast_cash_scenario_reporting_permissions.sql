-- Granular permissions for forecast, cash forecast, variance, dimensions and trial balance.
insert into public.organization_permissions(permission_key,name,description,permission_type,screen_key,category,sort_order) values
('cash.view','عرض التنبؤ النقدي','عرض بيانات التنبؤ النقدي','action','cash','planning',240),
('cash.create','إنشاء التنبؤ النقدي','إضافة خطوط التنبؤ النقدي','action','cash','planning',241),
('cash.edit','تعديل التنبؤ النقدي','تعديل خطوط التنبؤ النقدي','action','cash','planning',242),
('cash.delete','حذف التنبؤ النقدي','حذف خطوط التنبؤ النقدي','action','cash','planning',243),
('variance.view','عرض تحليل الانحرافات','عرض مقارنة الفعلي بالميزانية والتوقعات','action','variance','analysis',250),
('dimensions.view','عرض تحليل الأبعاد','عرض تحليل الفروع ومراكز التكلفة','action','dimensions','analysis',251),
('trial_balance.view','عرض ميزان المراجعة','عرض ميزان المراجعة','action','trial_balance','reporting',260)
on conflict(permission_key) do nothing;

insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select m.organization_id,m.user_id,p.permission_key,true
from public.organization_members m
join public.organization_permissions p on p.permission_key in ('cash.view','cash.create','cash.edit','cash.delete','variance.view','dimensions.view','trial_balance.view')
where m.permissions_initialized=true and m.role_key in ('company_admin','executive_director')
on conflict (organization_id,user_id,permission_key) do update set granted=true;