create or replace function public.get_tax_zakat_mapping_suggestions(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare r jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not (public.has_org_permission(p_organization_id,'screen.financial_statements.view') or public.has_org_permission(p_organization_id,'view')) then raise exception 'Financial statements view permission required'; end if;
 with x as (
  select a.id,a.code,a.name,a.account_type,a.statement_subclassification,m.zakat_treatment,m.income_tax_treatment,m.approved,
   case when a.statement_subclassification in ('revenue','other_income') then 'taxable_income'
        when a.statement_subclassification in ('cogs','operating_expense','finance_cost','other_expense') then 'deductible_expense'
        when a.statement_subclassification='depreciation_amortization' then 'book_depreciation'
        when a.statement_subclassification='tax' then 'needs_review'
        else 'not_applicable' end as suggested_tax,
   case when a.statement_subclassification='asset' and (lower(a.name) like '%نقد%' or lower(a.name) like '%بنك%' or lower(a.name) like '%صندوق%' or lower(a.name) like '%cash%' or lower(a.name) like '%bank%') then 'zakatable_asset'
        when a.statement_subclassification='asset' and (lower(a.name) like '%استثمار%' or lower(a.name) like '%investment%') then 'zakatable_investment'
        when a.statement_subclassification='liability' then 'deductible_liability'
        when a.statement_subclassification='equity' then 'internal_source'
        else 'needs_review' end as suggested_zakat,
   case when a.statement_subclassification in ('revenue','other_income','cogs','operating_expense','finance_cost','other_expense') then 'تصنيف مبدئي مبني على تصنيف قائمة الدخل؛ يلزم اعتماد المعالجة الضريبية.'
        when a.statement_subclassification='depreciation_amortization' then 'استهلاك محاسبي؛ يجب تحديد المعالجة الضريبية والإهلاك الضريبي حسب النظام.'
        else 'لا توجد قاعدة آلية كافية للاعتماد؛ يلزم مراجعة المعالجة الزكوية للحساب.' end as reason
  from public.accounts a left join public.tax_zakat_account_mappings m on m.organization_id=p_organization_id and m.account_id=a.id
  where a.organization_id=p_organization_id and (m.account_id is null or not m.approved or m.zakat_treatment='needs_review' or m.income_tax_treatment='needs_review')
 ) select coalesce(jsonb_agg(jsonb_build_object('account_id',id,'code',code,'name',name,'account_type',account_type,'statement_subclassification',statement_subclassification,'current_zakat_treatment',zakat_treatment,'current_income_tax_treatment',income_tax_treatment,'approved',coalesce(approved,false),'suggested_zakat_treatment',suggested_zakat,'suggested_income_tax_treatment',suggested_tax,'reason',reason) order by code),'[]'::jsonb) into r from x;
 return jsonb_build_object('organization_id',p_organization_id,'suggestions',r,'disclaimer','اقتراحات للمراجعة فقط وليست اعتمادًا نظاميًا ولا يتم تطبيقها تلقائيًا.');
end;$function$;
revoke all on function public.get_tax_zakat_mapping_suggestions(uuid) from public;
grant execute on function public.get_tax_zakat_mapping_suggestions(uuid) to authenticated;
