"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Period = { id: string; period_start: string; period_end: string; status: string };
type Option = { id: string; code?: string | null; name: string };
type FS = any;
type OCI = any;
type StatementKey = "balance" | "income" | "oci" | "cash" | "equity";
type Filters = Record<string, string>;
type TaxResult = any;

const statements: StatementKey[] = ["balance", "income", "oci", "cash", "equity"];
const statementNames: Record<StatementKey, string> = {
  balance: "قائمة المركز المالي",
  income: "قائمة الدخل",
  oci: "قائمة الدخل الشامل الآخر",
  cash: "قائمة التدفقات النقدية",
  equity: "قائمة التغيرات في حقوق الملكية",
};
const fields = [
  { key: "branch", label: "الفرع", itemsKey: "branches" },
  { key: "department", label: "الإدارة", itemsKey: "departments" },
  { key: "cost_center", label: "مركز التكلفة", itemsKey: "cost_centers" },
  { key: "region", label: "المنطقة", itemsKey: "regions" },
  { key: "product", label: "المنتج", itemsKey: "products" },
  { key: "project", label: "المشروع", itemsKey: "projects" },
  { key: "account", label: "الحساب", itemsKey: "accounts" },
] as const;
const emptyFilters = (): Filters => ({ branch: "", department: "", cost_center: "", region: "", product: "", project: "", account: "" });

const money = (value: unknown) =>
  (Number(value || 0) / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
const isoStart = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}-01`;

function Metric({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[11px] font-bold text-slate-400">{label}</p><p className="mt-2 text-lg font-bold tabular-nums text-slate-950">{money(value)}</p></div>;
}
function Row({ label, value, strong = false }: { label: string; value: unknown; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0 ${strong ? "font-bold text-slate-950" : "text-slate-700"}`}><span>{label}</span><span className="tabular-nums">{money(value)}</span></div>;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-xl border border-slate-100 bg-white p-4"><h4 className="mb-3 text-sm font-bold text-slate-950">{title}</h4>{children}</div>;
}
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">{text}</div>; }

function Balance({ data }: { data: FS }) {
  const accounts = data?.accounts || [];
  return <div className="grid gap-6 lg:grid-cols-3">
    <Section title="الأصول"><Row label="إجمالي الأصول" value={data?.total_assets} strong /></Section>
    <Section title="الالتزامات"><Row label="إجمالي الالتزامات" value={data?.total_liabilities} strong /></Section>
    <Section title="حقوق الملكية"><Row label="حقوق الملكية المعروضة" value={data?.displayed_equity ?? data?.total_equity} strong /><Row label="صافي الربح YTD" value={data?.ytd_net_income} /></Section>
    <div className="lg:col-span-3 rounded-xl bg-slate-50 p-4 text-sm font-bold">اختبار التوازن: {money(data?.balance_check)} {Number(data?.balance_check || 0) === 0 ? "✓ متوازن" : "— يحتاج مراجعة"}</div>
    <div className="lg:col-span-3 overflow-x-auto rounded-xl border border-slate-100 bg-white">
      <table className="w-full min-w-[900px] text-right text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="px-3 py-3">الحساب</th><th className="px-3 py-3">التصنيف</th><th className="px-3 py-3">مدين</th><th className="px-3 py-3">دائن</th><th className="px-3 py-3">الرصيد</th></tr></thead>
      <tbody>{accounts.map((row: any) => <tr key={`${row.code}-${row.name}`} className="border-b border-slate-100"><td className="px-3 py-2 font-semibold">{row.code} — {row.name}</td><td className="px-3 py-2 text-xs text-slate-500">{row.subclassification || "غير مصنف"}</td><td className="px-3 py-2 tabular-nums">{money(row.debit)}</td><td className="px-3 py-2 tabular-nums">{money(row.credit)}</td><td className="px-3 py-2 tabular-nums">{money(row.balance)}</td></tr>)}</tbody></table>
    </div>
  </div>;
}
function Income({ data, terms }: { data: FS; terms: any }) {
  return <div className="max-w-4xl rounded-xl border border-slate-100 bg-white p-5">
    <Row label={terms?.revenue || "الإيرادات"} value={data?.revenue} />
    <Row label={terms?.cogs || "تكلفة المبيعات"} value={data?.cogs} />
    <Row label="مجمل الربح" value={data?.gross_profit} strong />
    <Row label={terms?.operating_expenses || "المصروفات التشغيلية"} value={data?.operating_expenses} />
    <Row label="الدخل الآخر" value={data?.other_income} />
    <Row label="الربح التشغيلي" value={data?.operating_profit ?? data?.ebitda} strong />
    <Row label="الإهلاك والاستهلاك" value={data?.depreciation_amortization} />
    <Row label="الربح قبل التمويل والضريبة" value={data?.profit_before_financing_and_tax ?? data?.ebit} strong />
    <Row label="تكلفة التمويل" value={data?.finance_cost} />
    <Row label="المصروفات الأخرى" value={data?.other_expenses} />
    <Row label="الربح قبل ضريبة الدخل" value={data?.ebt} strong />
    <Row label="مصروف ضريبة الدخل" value={data?.tax} />
    <Row label="صافي الربح أو الخسارة" value={data?.net_income} strong />
  </div>;
}
function OCIView({ data }: { data: OCI | null }) {
  if (!data) return <Empty text="لا توجد بيانات للدخل الشامل الآخر في الفترة الحالية." />;
  return <div className="grid gap-6 lg:grid-cols-2"><Section title="الفترة الحالية">{(data.period?.rows || []).map((row: any) => <Row key={row.code} label={`${row.code} — ${row.name}`} value={row.amount} />)}<Row label="إجمالي الدخل الشامل الآخر" value={data.period?.total} strong /></Section><Section title="من بداية السنة المالية">{(data.ytd?.rows || []).map((row: any) => <Row key={row.code} label={`${row.code} — ${row.name}`} value={row.amount} />)}<Row label="إجمالي الدخل الشامل الآخر YTD" value={data.ytd?.total} strong /></Section></div>;
}
function CashFlow({ data }: { data: FS }) {
  const op = data?.operating || {}, inv = data?.investing || {}, fin = data?.financing || {}, direct = data?.method === "direct";
  return <div className="grid gap-6 lg:grid-cols-3"><Section title="الأنشطة التشغيلية"><Row label={direct ? "المقبوضات التشغيلية" : "صافي الربح"} value={direct ? op.cash_inflows : op.net_income} />{direct ? <Row label="المدفوعات التشغيلية" value={-Number(op.cash_outflows || 0)} /> : <><Row label="الإهلاك والاستهلاك" value={op.depreciation_amortization} /><Row label="تغيرات رأس المال العامل" value={op.working_capital_change} /></>}<Row label="صافي التدفق النقدي من الأنشطة التشغيلية" value={op.net_operating_cash_flow} strong /></Section><Section title="الأنشطة الاستثمارية"><Row label="صافي التدفق النقدي من الأنشطة الاستثمارية" value={inv.net_cash_flow} strong /></Section><Section title="الأنشطة التمويلية"><Row label="صافي التدفق النقدي من الأنشطة التمويلية" value={fin.net_cash_flow} strong /></Section><div className="lg:col-span-3 grid gap-3 sm:grid-cols-3"><Metric label="النقد وما في حكمه أول الفترة" value={data?.opening_cash} /><Metric label="صافي التغير في النقد" value={data?.net_change} /><Metric label="النقد وما في حكمه آخر الفترة" value={data?.closing_cash} /></div><div className="lg:col-span-3 rounded-xl bg-slate-50 p-4 text-sm font-bold">مطابقة النقدية: {money(data?.reconciliation_difference)} {Number(data?.reconciliation_difference || 0) === 0 ? "✓ متطابقة" : "— تحتاج مراجعة"}</div></div>;
}
function Equity({ data }: { data: FS }) {
  return <div className="grid gap-6 lg:grid-cols-2"><Section title="التغير في حقوق الملكية"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-right text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="px-3 py-3">البند</th><th className="px-3 py-3">الرصيد الافتتاحي</th><th className="px-3 py-3">التغير خلال الفترة</th><th className="px-3 py-3">الرصيد الختامي</th></tr></thead><tbody>{(data?.rows || []).map((row: any) => <tr key={`${row.code}-${row.name}`} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{row.code} — {row.name}</td><td className="px-3 py-3 tabular-nums">{money(row.opening)}</td><td className="px-3 py-3 tabular-nums">{money(row.movement)}</td><td className="px-3 py-3 tabular-nums">{money(row.closing)}</td></tr>)}</tbody></table></div></Section><Section title="المحصلة"><Row label="صافي الربح YTD" value={data?.ytd_net_income} strong /><Row label="حقوق الملكية الختامية المعروضة" value={data?.displayed_closing_equity} strong /></Section></div>;
}

function FilterBar({ options, filters, onChange, onClear }: { options: any; filters: Filters; onChange: (next: Filters) => void; onClear: () => void }) {
  const [field, setField] = useState("branch");
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const fieldDef = fields.find((item) => item.key === field) || fields[0];
  const items = ((options[fieldDef.itemsKey] || []) as Option[]).filter((item) => `${item.code || ""} ${item.name}`.toLocaleLowerCase("ar").includes(query.toLocaleLowerCase("ar")));
  const active = Object.entries(filters).filter(([, v]) => Boolean(v));
  const labelOf = (key: string) => fields.find((item) => item.key === key)?.label || key;
  const nameOf = (key: string, id: string) => ((options[fields.find((item) => item.key === key)?.itemsKey || ""] || []) as Option[]).find((item) => item.id === id)?.name || id;
  const add = () => { if (!value) return; onChange({ ...filters, [field]: value }); setValue(""); setQuery(""); };
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500">تصفية:</span>
        {active.map(([key, id]) => <button key={key} onClick={() => onChange({ ...filters, [key]: "" })} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">{labelOf(key)}: {nameOf(key, id)} ×</button>)}
        {active.length > 0 && <button onClick={onClear} className="text-xs font-bold text-red-600">مسح الكل</button>}
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={field} onChange={(e) => { setField(e.target.value); setValue(""); setQuery(""); }} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold"><option value="">إضافة فلتر</option>{fields.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
        <div className="relative"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث داخل القيم..." className="min-h-10 w-52 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" />{query && <div className="absolute right-0 top-11 z-40 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">{items.slice(0,50).map((item) => <button type="button" key={item.id} onClick={() => { setValue(item.id); setQuery(item.name); }} className="block w-full rounded px-2 py-2 text-right text-xs hover:bg-slate-100">{item.code ? `${item.code} — ` : ""}{item.name}</button>)}</div>}</div>
        <button onClick={add} disabled={!value} className="min-h-10 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-40">إضافة</button>
      </div>
    </div>
  </div>;
}

function TaxPanel({ result, regime, setRegime, ownership, setOwnership, onCalculate, running }: { result: TaxResult; regime: string; setRegime: (v: string) => void; ownership: string; setOwnership: (v: string) => void; onCalculate: () => void; running: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" dir="rtl"><div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold text-slate-950">حاسبة الزكاة وضريبة الدخل</h3><p className="mt-1 text-xs leading-5 text-slate-500">الحساب آلي من القوائم الحالية، مع إبقاء المعالجات النظامية القابلة للتعديل تحت مراجعة المستخدم.</p></div><button onClick={() => setRegime("close")} className="text-xl text-slate-400">×</button></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><button onClick={() => setRegime("zakat")} className={`rounded-xl border p-3 text-sm font-bold ${regime === "zakat" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200"}`}>زكاة</button><button onClick={() => setRegime("income_tax")} className={`rounded-xl border p-3 text-sm font-bold ${regime === "income_tax" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200"}`}>ضريبة دخل</button><button onClick={() => setRegime("mixed")} className={`rounded-xl border p-3 text-sm font-bold ${regime === "mixed" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200"}`}>مختلطة</button></div>{regime !== "zakat" && regime !== "close" && <div className="mt-4 rounded-xl bg-slate-50 p-4"><label className="text-xs font-bold text-slate-600">نسبة الملكية السعودية %</label><input type="number" min="0" max="100" value={ownership} onChange={(e) => setOwnership(e.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3" /><p className="mt-2 text-[11px] text-slate-500">ضريبة الدخل في السعودية ترتبط بحصة الشركاء غير السعوديين وفق نظام ضريبة الدخل.</p></div>}<button onClick={onCalculate} disabled={running || regime === "close"} className="mt-4 min-h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50">{running ? "جاري الحساب..." : "احسب الآن"}</button>{result && regime !== "close" && <div className="mt-5 grid gap-3 sm:grid-cols-2"><Metric label="الربح قبل الضريبة YTD" value={result.profit_before_tax_ytd} /><Metric label="وعاء الزكاة التقديري" value={result.preliminary_zakat_base} /><Metric label="الزكاة التقديرية" value={result.preliminary_zakat} /><Metric label="ضريبة الدخل التقديرية" value={result.preliminary_income_tax} /><Metric label="إجمالي المبلغ التقديري" value={result.total_preliminary_charge} /><div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{result.warning}</div></div>}</div></div>;
}

export default function FinancialStatementsPage() {
  const supabase = getSupabaseBrowserClient();
  const [org, setOrg] = useState("");
  const [industry, setIndustry] = useState("");
  const [fiscalStartMonth, setFiscalStartMonth] = useState(1);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [period, setPeriod] = useState("");
  const [data, setData] = useState<FS | null>(null);
  const [oci, setOci] = useState<OCI | null>(null);
  const [equityRollforward, setEquityRollforward] = useState<any>(null);
  const [options, setOptions] = useState<any>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [template, setTemplate] = useState("standard");
  const [cashMethod, setCashMethod] = useState("indirect");
  const [active, setActive] = useState<StatementKey>("balance");
  const [filtersByStatement, setFiltersByStatement] = useState<Record<StatementKey, Filters>>({ balance: emptyFilters(), income: emptyFilters(), oci: emptyFilters(), cash: emptyFilters(), equity: emptyFilters() });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [taxRunning, setTaxRunning] = useState(false);
  const [taxResult, setTaxResult] = useState<TaxResult>(null);
  const [taxRegime, setTaxRegime] = useState("zakat");
  const [saudiOwnership, setSaudiOwnership] = useState("100");
  const [error, setError] = useState("");

  useEffect(() => {
    const id = window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId") || "";
    setOrg(id);
    if (!id) { setError("لم يتم تحديد مساحة عمل."); setLoading(false); return; }
    const savedTemplate = window.localStorage.getItem(`fpa:statement-template:${id}`);
    const savedMethod = window.localStorage.getItem(`fpa:cash-method:${id}`);
    if (savedTemplate) setTemplate(savedTemplate);
    if (savedMethod) setCashMethod(savedMethod);
    void Promise.all([
      supabase.from("financial_periods").select("id,period_start,period_end,status").eq("organization_id", id).order("period_start", { ascending: false }),
      supabase.from("organizations").select("industry,fiscal_year_start_month").eq("id", id).maybeSingle(),
      supabase.from("financial_statement_templates").select("template_key,name_ar,name_en,activity_key,description_ar,config").eq("is_active", true).order("is_system", { ascending: false }),
      supabase.rpc("get_reporting_filter_options", { p_organization_id: id }),
    ]).then(([periodResult, orgResult, templateResult, filterResult]) => {
      if (periodResult.error) setError(periodResult.error.message);
      const rows = (periodResult.data || []) as Period[];
      setPeriods(rows); if (rows[0]) setPeriod(rows[0].id);
      if (!orgResult.error) { setIndustry(orgResult.data?.industry || ""); setFiscalStartMonth(Number(orgResult.data?.fiscal_year_start_month || 1)); }
      if (!templateResult.error) setTemplates(templateResult.data || []);
      if (!filterResult.error) setOptions(filterResult.data || {});
      setLoading(false);
    });
  }, [supabase]);

  const filters = filtersByStatement[active];
  const activeTemplate = useMemo(() => templates.find((item) => item.template_key === template), [templates, template]);
  const preferredTerms = activeTemplate?.config?.preferred_terms || {};
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const selectedPeriod = periods.find((item) => item.id === period);
  const reportStart = useMemo(() => {
    if (!selectedPeriod) return "";
    const end = new Date(`${selectedPeriod.period_end}T00:00:00`);
    const month = Number(fiscalStartMonth || 1);
    const year = end.getMonth() + 1 < month ? end.getFullYear() - 1 : end.getFullYear();
    return isoStart(year, month);
  }, [selectedPeriod, fiscalStartMonth]);
  const reportRange = selectedPeriod ? `من ${date(reportStart)} إلى ${date(selectedPeriod.period_end)}` : "";

  const setFilters = (next: Filters) => { setFiltersByStatement((prev) => ({ ...prev, [active]: next })); setData(null); setOci(null); setEquityRollforward(null); };
  const chooseTemplate = (value: string) => { setTemplate(value); if (org) window.localStorage.setItem(`fpa:statement-template:${org}`, value); setData(null); };
  const chooseMethod = (value: string) => { setCashMethod(value); if (org) window.localStorage.setItem(`fpa:cash-method:${org}`, value); setData(null); };

  async function load() {
    if (!org || !period) return;
    setRunning(true); setError("");
    const args = { p_organization_id: org, p_period_id: period, p_branch_id: filters.branch || null, p_department_id: filters.department || null, p_cost_center_id: filters.cost_center || null, p_region_id: filters.region || null, p_product_id: filters.product || null, p_project_id: filters.project || null, p_account_id: filters.account || null, p_cash_flow_method: cashMethod };
    const [statementResult, ociResult, equityResult] = await Promise.all([
      supabase.rpc("get_financial_statements_v2", args),
      supabase.rpc("get_other_comprehensive_income", { p_organization_id: org, p_period_id: period, p_branch_id: filters.branch || null, p_department_id: filters.department || null, p_cost_center_id: filters.cost_center || null, p_region_id: filters.region || null, p_product_id: filters.product || null, p_project_id: filters.project || null }),
      supabase.rpc("get_equity_rollforward", { p_organization_id: org, p_period_id: period, p_branch_id: filters.branch || null, p_department_id: filters.department || null, p_cost_center_id: filters.cost_center || null, p_region_id: filters.region || null, p_product_id: filters.product || null, p_project_id: filters.project || null, p_account_id: filters.account || null }),
    ]);
    if (statementResult.error) { setError(statementResult.error.message); setData(null); } else setData(statementResult.data as FS);
    if (ociResult.error) { setOci(null); if (!statementResult.error) setError(`تعذر تحميل قائمة الدخل الشامل الآخر: ${ociResult.error.message}`); } else setOci(ociResult.data as OCI);
    if (equityResult.error) { setEquityRollforward(null); if (!statementResult.error) setError(`تعذر تحميل قائمة التغيرات في حقوق الملكية: ${equityResult.error.message}`); } else setEquityRollforward(equityResult.data);
    setRunning(false);
  }

  async function calculateTax() {
    if (!org || !period || taxRegime === "close") return;
    setTaxRunning(true); setTaxResult(null);
    const r = await supabase.rpc("calculate_tax_zakat", { p_organization_id: org, p_period_id: period, p_branch_id: filters.branch || null, p_department_id: filters.department || null, p_cost_center_id: filters.cost_center || null, p_region_id: filters.region || null, p_product_id: filters.product || null, p_project_id: filters.project || null, p_regime: taxRegime, p_saudi_ownership_percent: Number(saudiOwnership || 0), p_income_tax_rate: 20, p_zakat_rate: 2.5 });
    if (r.error) setError(r.error.message); else setTaxResult(r.data);
    setTaxRunning(false);
  }

  const headerPeriod = active === "balance" ? `كما في ${selectedPeriod ? date(selectedPeriod.period_end) : ""}` : `${reportRange} — الفترة المنتهية في ${selectedPeriod ? date(selectedPeriod.period_end) : ""}`;
  const displayedEquity = equityRollforward?.closing_equity ?? data?.displayed_closing_equity ?? data?.total_equity;

  if (loading) return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] p-8 text-center text-sm text-slate-500">جاري تحميل مركز القوائم المالية...</main>;

  return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-[#172033]">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"><a href="/workspace" className="text-sm font-semibold text-slate-500">العودة لمساحة العمل</a><div className="text-right"><p className="text-[10px] font-bold tracking-[.14em] text-slate-400">FINANCIAL REPORTING</p><h1 className="mt-1 font-bold text-slate-950">مركز القوائم المالية</h1></div></div></header>
    <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold text-slate-400">{industry || "ملف النشاط"}</p><h2 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">{statementNames[active]}</h2><p className="mt-2 text-sm font-semibold text-slate-600">{headerPeriod}</p><p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">عرض مالي احترافي مرتبط بدفتر الأستاذ، مع فترة التقرير والسنة المالية والفلاتر التحليلية المستقلة لكل قائمة.</p></div><div className="flex flex-wrap gap-2"><select value={template} onChange={(e) => chooseTemplate(e.target.value)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold"><option value="standard">القالب القياسي</option>{templates.filter((item) => item.template_key !== "standard").map((item) => <option key={item.template_key} value={item.template_key}>{item.name_ar}</option>)}</select><select value={cashMethod} onChange={(e) => chooseMethod(e.target.value)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold"><option value="indirect">التدفقات — غير مباشرة</option><option value="direct">التدفقات — مباشرة</option></select><button onClick={() => { setTaxOpen(true); setTaxRegime("zakat"); setTaxResult(null); }} className="min-h-10 rounded-lg border border-slate-950 bg-white px-4 text-sm font-bold text-slate-950">احسب الزكاة / ضريبة الدخل</button></div></div></div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_auto]"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center gap-2">{statements.map((key) => <button key={key} onClick={() => { setActive(key); setData(null); setOci(null); setEquityRollforward(null); }} className={`min-h-10 rounded-lg px-4 text-sm font-bold ${active === key ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>{statementNames[key]}</button>)}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><select value={period} onChange={(e) => { setPeriod(e.target.value); setData(null); setOci(null); setEquityRollforward(null); }} className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold">{periods.map((item) => <option key={item.id} value={item.id}>{date(item.period_start)} — {date(item.period_end)}</option>)}</select></div></div>

      <div className="mt-3"><FilterBar options={options} filters={filters} onChange={setFilters} onClear={() => setFilters(emptyFilters())} /></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{activeFilterCount ? `${activeFilterCount} فلتر مطبق على ${statementNames[active]}` : `بدون فلاتر إضافية — ${statementNames[active]}`}</p><button disabled={!period || running} onClick={load} className="min-h-11 rounded-xl bg-slate-950 px-6 text-sm font-bold text-white disabled:opacity-50">{running ? "جاري الحساب..." : "تطبيق الفلاتر وإعادة الحساب"}</button></div>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      {data && <div className="mt-5 space-y-5">
        {active === "balance" && <Balance data={data} />}
        {active === "income" && <Income data={data?.income_statement_period || data?.income_statement_ytd || data} terms={preferredTerms} />}
        {active === "oci" && <OCIView data={oci} />}
        {active === "cash" && <CashFlow data={data} />}
        {active === "equity" && <Equity data={{ ...(data || {}), ...(equityRollforward || {}), rows: equityRollforward?.rows || data?.rows, displayed_closing_equity: displayedEquity, ytd_net_income: equityRollforward?.net_income ?? data?.ytd_net_income }} />}
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500"><strong className="text-slate-700">ملاحظة العرض:</strong> قائمة المركز المالي تُعرض "كما في" تاريخ التقرير، بينما قوائم الأداء والتدفقات والتغيرات في حقوق الملكية تُعرض "عن الفترة المنتهية في" تاريخ التقرير. تم تصميم التسميات لتتوافق مع عرض القوائم المالية وفق IFRS/المعايير المعتمدة في المملكة، مع دعم متطلبات العرض المستقبلية لـ IFRS 18.</div>
      </div>}
      {!data && !running && <div className="mt-8"><Empty text="اختر الفترة والفلاتر ثم اضغط تطبيق لعرض القائمة." /></div>}
    </section>
    {taxOpen && <TaxPanel result={taxResult} regime={taxRegime} setRegime={(value) => { if (value === "close") { setTaxOpen(false); return; } setTaxRegime(value); setTaxResult(null); }} ownership={saudiOwnership} setOwnership={setSaudiOwnership} onCalculate={calculateTax} running={taxRunning} />}
  </main>;
}
