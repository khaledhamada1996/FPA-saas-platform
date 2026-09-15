-- Activity-specific reporting blueprint engine.
-- The selected company activity determines the reporting template and the
-- baseline IFRS presentation hierarchy used for account aggregation.

create table if not exists public.activity_account_blueprints (
  activity_key text not null references public.financial_activities(activity_key) on delete cascade,
  code text not null,
  name_ar text not null,
  parent_code text,
  statement_type text not null,
  statement_section text not null,
  statement_subclassification text not null,
  normal_balance text not null,
  is_contra boolean not null default false,
  sort_order integer not null default 0,
  primary key (activity_key, code)
);

alter table public.activity_account_blueprints enable row level security;
drop policy if exists activity_account_blueprints_read on public.activity_account_blueprints;
create policy activity_account_blueprints_read on public.activity_account_blueprints
  for select to authenticated using (true);

-- Shared IFRS-oriented hierarchy used by every activity, with activity-specific
-- revenue/cost accounts added below. The hierarchy is intentionally stored as
-- account metadata so the financial-statement engine can roll balances up by
-- parent_account_id rather than relying on presentation-only labels.
insert into public.activity_account_blueprints
(activity_key, code, name_ar, parent_code, statement_type, statement_section,
 statement_subclassification, normal_balance, is_contra, sort_order)
select a.activity_key, v.code, v.name_ar, v.parent_code, v.statement_type,
       v.statement_section, v.statement_subclassification, v.normal_balance,
       v.is_contra, v.sort_order
from public.financial_activities a
cross join (values
 ('1000','الأصول',null,'balance_sheet','الأصول','asset','debit',false,10),
 ('1100','الأصول المتداولة','1000','balance_sheet','الأصول','asset','debit',false,20),
 ('1110','النقدية وما في حكمها','1100','balance_sheet','الأصول','asset','debit',false,30),
 ('1120','الذمم المدينة التجارية','1100','balance_sheet','الأصول','asset','debit',false,40),
 ('1130','المخزون','1100','balance_sheet','الأصول','asset','debit',false,50),
 ('1200','الأصول غير المتداولة','1000','balance_sheet','الأصول','asset','debit',false,60),
 ('1210','الممتلكات والآلات والمعدات','1200','balance_sheet','الأصول','asset','debit',false,70),
 ('1220','مجمع الإهلاك','1200','balance_sheet','الأصول','asset','credit',true,80),
 ('1230','الأصول غير الملموسة','1200','balance_sheet','الأصول','asset','debit',false,90),
 ('2000','الالتزامات',null,'balance_sheet','الالتزامات','liability','credit',false,100),
 ('2100','الالتزامات المتداولة','2000','balance_sheet','الالتزامات','liability','credit',false,110),
 ('2200','الالتزامات غير المتداولة','2000','balance_sheet','الالتزامات','liability','credit',false,120),
 ('3000','حقوق الملكية',null,'balance_sheet','حقوق الملكية','equity','credit',false,130),
 ('3100','رأس المال','3000','balance_sheet','حقوق الملكية','equity','credit',false,140),
 ('3200','الأرباح المحتجزة','3000','balance_sheet','حقوق الملكية','equity','credit',false,150),
 ('4000','الإيرادات',null,'income_statement','الإيرادات','revenue','credit',false,200),
 ('5000','تكلفة الإيرادات',null,'income_statement','تكلفة الإيرادات','cogs','debit',false,210),
 ('6000','المصروفات التشغيلية',null,'income_statement','المصروفات التشغيلية','operating_expense','debit',false,220),
 ('6100','المصروفات الإدارية والعمومية','6000','income_statement','المصروفات التشغيلية','operating_expense','debit',false,230),
 ('6200','مصروفات البيع والتسويق','6000','income_statement','المصروفات التشغيلية','operating_expense','debit',false,240),
 ('7000','بنود أخرى وصافي التمويل والضريبة',null,'income_statement','بنود أخرى','other_expense','debit',false,250)
) v(code,name_ar,parent_code,statement_type,statement_section,statement_subclassification,normal_balance,is_contra,sort_order)
where a.is_active
on conflict (activity_key, code) do update set
  name_ar=excluded.name_ar,parent_code=excluded.parent_code,
  statement_type=excluded.statement_type,statement_section=excluded.statement_section,
  statement_subclassification=excluded.statement_subclassification,
  normal_balance=excluded.normal_balance,is_contra=excluded.is_contra,
  sort_order=excluded.sort_order;

insert into public.activity_account_blueprints
(activity_key,code,name_ar,parent_code,statement_type,statement_section,
 statement_subclassification,normal_balance,is_contra,sort_order)
values
 ('trading','4010','مبيعات البضائع','4000','income_statement','الإيرادات','revenue','credit',false,201),
 ('trading','5010','تكلفة البضاعة المباعة','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,211),
 ('trading','1131','مخزون البضائع','1130','balance_sheet','الأصول','asset','debit',false,51),
 ('restaurant','4010','إيرادات الطعام','4000','income_statement','الإيرادات','revenue','credit',false,201),
 ('restaurant','4020','إيرادات المشروبات','4000','income_statement','الإيرادات','revenue','credit',false,202),
 ('restaurant','5010','تكلفة المواد الغذائية','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,211),
 ('restaurant','5020','تكلفة المشروبات','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,212),
 ('restaurant','5030','عمولات منصات التوصيل','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,213),
 ('manufacturing','4010','إيرادات المنتجات المصنعة','4000','income_statement','الإيرادات','revenue','credit',false,201),
 ('manufacturing','5010','المواد الخام المستخدمة','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,211),
 ('manufacturing','5020','تكاليف العمالة المباشرة','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,212),
 ('manufacturing','5030','التكاليف الصناعية غير المباشرة','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,213),
 ('contracting','4010','إيرادات عقود الإنشاء','4000','income_statement','الإيرادات','revenue','credit',false,201),
 ('contracting','5010','تكاليف العقود المباشرة','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,211),
 ('contracting','5020','تكاليف العمالة المباشرة للمشروعات','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,212),
 ('contracting','5030','تكاليف مواد ومعدات المشروعات','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,213),
 ('contracting','1141','أعمال تحت التنفيذ','1130','balance_sheet','الأصول','asset','debit',false,52),
 ('services','4010','إيرادات الخدمات','4000','income_statement','الإيرادات','revenue','credit',false,201),
 ('services','5010','تكلفة تقديم الخدمات','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,211),
 ('technology','4010','إيرادات البرمجيات والاشتراكات','4000','income_statement','الإيرادات','revenue','credit',false,201),
 ('technology','4020','إيرادات الخدمات التقنية','4000','income_statement','الإيرادات','revenue','credit',false,202),
 ('technology','5010','تكلفة الخدمات السحابية والتشغيل','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,211),
 ('technology','1231','أصول غير ملموسة - برمجيات مطورة','1230','balance_sheet','الأصول','asset','debit',false,91),
 ('real_estate','4010','إيرادات الإيجارات','4000','income_statement','الإيرادات','revenue','credit',false,201),
 ('real_estate','4020','إيرادات بيع العقارات','4000','income_statement','الإيرادات','revenue','credit',false,202),
 ('real_estate','5010','تكلفة العقارات المباعة','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,211),
 ('healthcare','4010','إيرادات الخدمات الصحية','4000','income_statement','الإيرادات','revenue','credit',false,201),
 ('healthcare','5010','تكلفة الخدمات والمواد الطبية','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,211),
 ('education','4010','إيرادات التعليم والتدريب','4000','income_statement','الإيرادات','revenue','credit',false,201),
 ('education','5010','تكلفة تقديم البرامج التعليمية','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,211),
 ('logistics','4010','إيرادات النقل والخدمات اللوجستية','4000','income_statement','الإيرادات','revenue','credit',false,201),
 ('logistics','5010','تكلفة النقل والتشغيل','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,211),
 ('agriculture','4010','إيرادات المنتجات الزراعية','4000','income_statement','الإيرادات','revenue','credit',false,201),
 ('agriculture','5010','تكاليف الإنتاج الزراعي','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,211),
 ('finance','4010','إيرادات التمويل','4000','income_statement','الإيرادات','revenue','credit',false,201),
 ('finance','4020','إيرادات العمولات والرسوم','4000','income_statement','الإيرادات','revenue','credit',false,202),
 ('finance','5010','تكاليف التمويل','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,211),
 ('investment','4010','إيرادات الاستثمارات','4000','income_statement','الإيرادات','revenue','credit',false,201),
 ('investment','4020','أرباح إعادة قياس الاستثمارات','4000','income_statement','الإيرادات','revenue','credit',false,202),
 ('investment','5010','خسائر وانخفاض قيمة الاستثمارات','5000','income_statement','تكلفة الإيرادات','cogs','debit',false,211)
on conflict (activity_key,code) do update set name_ar=excluded.name_ar,parent_code=excluded.parent_code,
 statement_type=excluded.statement_type,statement_section=excluded.statement_section,
 statement_subclassification=excluded.statement_subclassification,normal_balance=excluded.normal_balance,
 is_contra=excluded.is_contra,sort_order=excluded.sort_order;

create or replace function public.seed_activity_chart_of_accounts(p_organization_id uuid,p_activity_key text)
returns integer language plpgsql security definer set search_path='' as $$
declare r record; parent_id uuid; n integer:=0; v_account_type text;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if not public.has_org_permission(p_organization_id,'manage_settings') then raise exception 'FORBIDDEN'; end if;
 for r in select * from public.activity_account_blueprints where activity_key=p_activity_key order by sort_order,code loop
   parent_id:=null;
   if nullif(r.parent_code,'') is not null then
     select id into parent_id from public.accounts where organization_id=p_organization_id and code=r.parent_code limit 1;
   end if;
   v_account_type:=case when r.statement_subclassification='asset' then 'asset' when r.statement_subclassification='liability' then 'liability' when r.statement_subclassification='equity' then 'equity' when r.statement_subclassification='revenue' then 'revenue' else 'expense' end;
   insert into public.accounts(organization_id,code,name,normal_balance,account_type,statement_type,statement_section,is_contra,parent_account_id,statement_subclassification)
   values(p_organization_id,r.code,r.name_ar,r.normal_balance,v_account_type,r.statement_type,r.statement_section,r.is_contra,parent_id,r.statement_subclassification)
   on conflict do nothing;
   n:=n+1;
 end loop;
 return n;
end; $$;

grant execute on function public.seed_activity_chart_of_accounts(uuid,text) to authenticated;

create or replace function public.get_activity_reporting_blueprint(p_activity_key text)
returns table(code text,name_ar text,parent_code text,statement_type text,statement_section text,statement_subclassification text,normal_balance text,is_contra boolean,sort_order integer)
language sql stable security definer set search_path='' as $$
 select code,name_ar,parent_code,statement_type,statement_section,statement_subclassification,normal_balance,is_contra,sort_order
 from public.activity_account_blueprints where activity_key=p_activity_key order by sort_order,code;
$$;
grant execute on function public.get_activity_reporting_blueprint(text) to authenticated;
