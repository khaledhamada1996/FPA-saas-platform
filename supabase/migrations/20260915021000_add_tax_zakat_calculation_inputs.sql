create or replace function public.calculate_tax_zakat(
  p_organization_id uuid,
  p_period_id uuid,
  p_branch_id uuid default null,
  p_department_id uuid default null,
  p_cost_center_id uuid default null,
  p_region_id uuid default null,
  p_product_id uuid default null,
  p_project_id uuid default null,
  p_regime text default 'zakat',
  p_saudi_ownership_percent numeric default 100,
  p_income_tax_rate numeric default 20,
  p_zakat_rate numeric default 2.5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  base jsonb;
  ebt bigint := 0;
  taxable_profit bigint := 0;
  zakat_base bigint := 0;
  zakat bigint := 0;
  income_tax bigint := 0;
  saudi_share bigint := 0;
  non_saudi_share bigint := 0;
  regime text := lower(coalesce(p_regime,'zakat'));
  ownership numeric := greatest(0,least(100,coalesce(p_saudi_ownership_percent,100)));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if regime not in ('zakat','income_tax','mixed','none') then raise exception 'Invalid tax regime'; end if;
  if p_income_tax_rate < 0 or p_income_tax_rate > 100 then raise exception 'Invalid income tax rate'; end if;
  if p_zakat_rate < 0 or p_zakat_rate > 100 then raise exception 'Invalid zakat rate'; end if;

  base := public.calculate_tax_zakat(p_organization_id,p_period_id,p_branch_id,p_department_id,p_cost_center_id,p_region_id,p_product_id,p_project_id);
  ebt := coalesce((base->>'profit_before_tax_ytd')::bigint,0);
  taxable_profit := greatest(ebt,0);
  zakat_base := coalesce((base->>'preliminary_zakat_base')::bigint,0);
  zakat := round(zakat_base * p_zakat_rate / 100.0)::bigint;
  saudi_share := round(taxable_profit * ownership / 100.0)::bigint;
  non_saudi_share := greatest(taxable_profit-saudi_share,0);
  income_tax := round(non_saudi_share * p_income_tax_rate / 100.0)::bigint;

  return jsonb_build_object(
    'regime',regime,
    'period_id',p_period_id,
    'net_income_ytd',coalesce((base->>'net_income_ytd')::bigint,0),
    'profit_before_tax_ytd',ebt,
    'assets',coalesce((base->>'assets')::bigint,0),
    'liabilities',coalesce((base->>'liabilities')::bigint,0),
    'equity',coalesce((base->>'equity')::bigint,0),
    'preliminary_zakat_base',zakat_base,
    'preliminary_zakat',case when regime in ('zakat','mixed') then zakat else 0 end,
    'taxable_profit_assumption',taxable_profit,
    'saudi_ownership_percent',ownership,
    'saudi_taxable_share',saudi_share,
    'non_saudi_taxable_share',non_saudi_share,
    'preliminary_income_tax',case when regime in ('income_tax','mixed') then income_tax else 0 end,
    'total_preliminary_charge',case when regime in ('zakat','mixed') then zakat else 0 end + case when regime in ('income_tax','mixed') then income_tax else 0 end,
    'rates',jsonb_build_object('zakat_rate',p_zakat_rate,'income_tax_rate',p_income_tax_rate),
    'warning','هذه نتيجة تقديرية أولية وليست إقرارًا زكويًا أو ضريبيًا. الزكاة تعتمد على المعالجات والبنود الزكوية النظامية، وضريبة الدخل تعتمد على الربح الخاضع للضريبة والفروق الضريبية؛ يجب اعتماد التعديلات قبل التقديم.'
  );
end;
$function$;

revoke all on function public.calculate_tax_zakat(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,numeric,numeric,numeric) from public, anon;
grant execute on function public.calculate_tax_zakat(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,numeric,numeric,numeric) to authenticated;
