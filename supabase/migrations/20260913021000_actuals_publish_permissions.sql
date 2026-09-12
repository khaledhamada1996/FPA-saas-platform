insert into public.organization_permissions(permission_key,name,description,permission_type,sort_order)
values
('actuals.publish','نشر البيانات الفعلية','نشر البيانات المستوردة إلى البيانات المالية الفعلية','action',310),
('actuals.create','إدخال البيانات الفعلية','إنشاء أو إدخال بيانات فعلية','action',311),
('actuals.edit','تعديل البيانات الفعلية','تعديل البيانات الفعلية قبل الإقفال','action',312),
('actuals.delete','حذف البيانات الفعلية','حذف البيانات الفعلية المسموح بها','action',313),
('actuals.export','تصدير البيانات الفعلية','تصدير البيانات الفعلية','action',314)
on conflict (permission_key) do update set name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,sort_order=excluded.sort_order;

insert into public.organization_permissions(permission_key,name,description,permission_type,sort_order)
values
('mapping.view','عرض الخرائط','عرض خرائط الحسابات والبيانات','action',320),
('mapping.create','إنشاء خريطة','إنشاء خرائط جديدة','action',321),
('mapping.edit','تعديل الخريطة','تعديل الخرائط قبل اعتمادها','action',322),
('mapping.approve','اعتماد الخريطة','اعتماد خرائط الحسابات والبيانات','action',323),
('mapping.delete','حذف الخريطة','حذف الخرائط غير المستخدمة','action',324)
on conflict (permission_key) do update set name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,sort_order=excluded.sort_order;

insert into public.organization_permissions(permission_key,name,description,permission_type,sort_order)
values
('reports.view','عرض التقارير','عرض التقارير الإدارية والمالية','action',330),
('reports.create','إنشاء تقرير','إنشاء تقارير محفوظة','action',331),
('reports.export','تصدير التقارير','تصدير التقارير','action',332),
('statements.view','عرض القوائم المالية','عرض القوائم المالية','action',340),
('statements.export','تصدير القوائم المالية','تصدير القوائم المالية','action',341),
('audit.view','عرض سجل التدقيق','عرض سجل التدقيق','action',350),
('audit.export','تصدير سجل التدقيق','تصدير سجل التدقيق','action',351),
('company_profile.edit','تعديل ملف الشركة','تعديل بيانات وملف الشركة','action',360),
('ai_analyst.run','تشغيل المحلل المالي الذكي','تشغيل تحليل مالي بواسطة المحلل الذكي','action',370),
('ai_analyst.export','تصدير نتائج المحلل الذكي','تصدير نتائج التحليل الذكي','action',371)
on conflict (permission_key) do update set name=excluded.name,description=excluded.description,permission_type=excluded.permission_type,sort_order=excluded.sort_order;

-- Existing initialized company admins retain full operational access; other roles keep only explicitly granted permissions.
insert into public.organization_member_permission_overrides(organization_id,user_id,permission_key,granted)
select m.organization_id,m.user_id,p.permission_key,true
from public.organization_members m
cross join public.organization_permissions p
where coalesce(m.role_key,m.role) in ('company_admin','executive_director')
  and m.permissions_initialized=true
on conflict (organization_id,user_id,permission_key) do update set granted=true;
