"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Period = { id: string; period_start: string; period_end: string; status: string };
type Option = { id: string; code?: string | null; name: string };
type FS = any;
type OCI = any;

type StatementKey = "balance" | "income" | "oci" | "cash" | "equity";

const statements: StatementKey[] = ["balance", "income", "oci", "cash", "equity"];
const statementNames: Record<StatementKey, string> = {
  balance: "قائمة المركز المالي",
  income: "قائمة الدخل",
  oci: "قائمة الدخل الشامل الآخر",
  cash: "قائمة التدفقات النقدية",
  equity: "قائمة التغير في حقوق الملكية",
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

const money = (value: unknown) =>
  (Number(value || 0) / 100).toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const date = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-bold tabular-nums text-slate-950">{money(value)}</p>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: unknown; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b border-slate-100 py-3 last:border-0 ${strong ? "font-bold text-slate-950" : "text-slate-700"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <h4 className="mb-2 text-sm font-bold text-slate-950">{title}</h4>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">{text}</div>;
}

function Balance({ data }: { data: FS }) {
  const accounts = data?.accounts || [];
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Section title="الأصول"><Row label="إجمالي الأصول" value={data?.total_assets} strong /></Section>
      <Section title="الالتزامات"><Row label="إجمالي الالتزامات" value={data?.total_liabilities} strong /></Section>
      <Section title="حقوق الملكية"><Row label="حقوق الملكية" value={data?.total_equity} strong /><Row label="صافي الربح YTD" value={data?.ytd_net_income} /></Section>
      <div className="lg:col-span-3 rounded-xl bg-slate-50 p-4 text-sm font-bold">اختبار التوازن: {money(data?.balance_check)} {Number(data?.balance_check || 0) === 0 ? "✓ متوازن" : "— يحتاج مراجعة"}</div>
      <div className="lg:col-span-3 overflow-x-auto">
        <table className="w-full min-w-[900px] text-right text-sm">
          <thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="px-3 py-3">الحساب</th><th className="px-3 py-3">التصنيف</th><th className="px-3 py-3">مدين</th><th className="px-3 py-3">دائن</th><th className="px-3 py-3">الرصيد</th></tr></thead>
          <tbody>{accounts.map((row: any) => <tr key={`${row.code}-${row.name}`} className="border-b border-slate-100"><td className="px-3 py-2 font-semibold">{row.code} — {row.name}</td><td className="px-3 py-2 text-xs text-slate-500">{row.subclassification || "غير مصنف"}</td><td className="px-3 py-2 tabular-nums">{money(row.debit)}</td><td className="px-3 py-2 tabular-nums">{money(row.credit)}</td><td className="px-3 py-2 tabular-nums">{money(row.balance)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function Income({ data, terms }: { data: FS; terms: any }) {
  return <div className="max-w-4xl"><Row label={terms?.revenue || "الإيرادات"} value={data?.revenue} /><Row label={terms?.cogs || "تكلفة المبيعات"} value={data?.cogs} /><Row label="مجمل الربح" value={data?.gross_profit} strong /><Row label={terms?.operating_expenses || "المصروفات التشغيلية"} value={data?.operating_expenses} /><Row label="الدخل الآخر" value={data?.other_income} /><Row label="EBITDA" value={data?.ebitda} strong /><Row label="الإهلاك والاستهلاك" value={data?.depreciation_amortization} /><Row label="EBIT" value={data?.ebit} strong /><Row label="تكلفة التمويل" value={data?.finance_cost} /><Row label="المصروفات الأخرى" value={data?.other_expenses} /><Row label="الربح قبل الضريبة" value={data?.ebt} strong /><Row label="الضريبة" value={data?.tax} /><Row label="صافي الربح" value={data?.net_income} strong /></div>;
}

function OCIView({ data }: { data: OCI | null }) {
  if (!data) return <Empty text="لا توجد بيانات للدخل الشامل الآخر في الفترة الحالية." />;
  return <div className="grid gap-6 lg:grid-cols-2"><Section title="الفترة">{(data.period?.rows || []).map((row: any) => <Row key={row.code} label={`${row.code} — ${row.name}`} value={row.amount} />)}<Row label="إجمالي الدخل الشامل الآخر" value={data.period?.total} strong /></Section><Section title="من بداية السنة المالية">{(data.ytd?.rows || []).map((row: any) => <Row key={row.code} label={`${row.code} — ${row.name}`} value={row.amount} />)}<Row label="إجمالي الدخل الشامل الآخر YTD" value={data.ytd?.total} strong /></Section></div>;
}

function CashFlow({ data }: { data: FS }) {
  const op = data?.operating || {};
  const inv = data?.investing || {};
  const fin = data?.financing || {};
  const direct = data?.method === "direct";
  return <div className="grid gap-6 lg:grid-cols-3"><Section title="الأنشطة التشغيلية"><Row label={direct ? "المقبوضات التشغيلية" : "صافي الربح"} value={direct ? op.cash_inflows : op.net_income} />{direct ? <Row label="المدفوعات التشغيلية" value={-Number(op.cash_outflows || 0)} /> : <><Row label="الإهلاك والاستهلاك" value={op.depreciation_amortization} /><Row label="تسويات التشغيل ورأس المال العامل" value={op.working_capital_change} /></>}<Row label="صافي التدفق التشغيلي" value={op.net_operating_cash_flow} strong /></Section><Section title="الأنشطة الاستثمارية"><Row label="صافي التدفق الاستثماري" value={inv.net_cash_flow} strong /></Section><Section title="الأنشطة التمويلية"><Row label="صافي التدفق التمويلي" value={fin.net_cash_flow} strong /></Section><div className="lg:col-span-3 grid gap-3 sm:grid-cols-3"><Metric label="نقدية أول الفترة" value={data?.opening_cash} /><Metric label="التغير في النقدية" value={data?.net_change} /><Metric label="نقدية آخر الفترة" value={data?.closing_cash} /></div><div className="lg:col-span-3 rounded-xl bg-slate-50 p-4 text-sm font-bold">مطابقة النقدية: {money(data?.reconciliation_difference)} {Number(data?.reconciliation_difference || 0) === 0 ? "✓" : "— تحتاج مراجعة"}</div></div>;
}

function Equity({ data }: { data: FS }) {
  return <div className="grid gap-6 lg:grid-cols-2"><Section title="التغير في حقوق الملكية"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-right text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="px-3 py-3">البند</th><th className="px-3 py-3">افتتاحي</th><th className="px-3 py-3">الحركة</th><th className="px-3 py-3">ختامي</th></tr></thead><tbody>{(data?.rows || []).map((row: any) => <tr key={`${row.code}-${row.name}`} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{row.code} — {row.name}</td><td className="px-3 py-3 tabular-nums">{money(row.opening)}</td><td className="px-3 py-3 tabular-nums">{money(row.movement)}</td><td className="px-3 py-3 tabular-nums">{money(row.closing)}</td></tr>)}</tbody></table></div></Section><Section title="النتيجة المرتبطة بقائمة الدخل"><Row label="صافي الربح YTD" value={data?.ytd_net_income} strong /><Row label="حقوق الملكية المعروضة" value={data?.displayed_closing_equity} strong /></Section></div>;
}

export default function FinancialStatementsPage() {
  const supabase = getSupabaseBrowserClient();
  const [org, setOrg] = useState("");
  const [industry, setIndustry] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [period, setPeriod] = useState("");
  const [data, setData] = useState<FS | null>(null);
  const [oci, setOci] = useState<OCI | null>(null);
  const [options, setOptions] = useState<any>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [template, setTemplate] = useState("standard");
  const [cashMethod, setCashMethod] = useState("indirect");
  const [active, setActive] = useState<StatementKey>("balance");
  const [advanced, setAdvanced] = useState(false);
  const [filterField, setFilterField] = useState("branch");
  const [filterValue, setFilterValue] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({ branch: "", department: "", cost_center: "", region: "", product: "", project: "", account: "" });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
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
      supabase.from("organizations").select("industry").eq("id", id).maybeSingle(),
      supabase.from("financial_statement_templates").select("template_key,name_ar,name_en,activity_key,description_ar,config").eq("is_active", true).order("is_system", { ascending: false }),
      supabase.rpc("get_reporting_filter_options", { p_organization_id: id }),
    ]).then(([periodResult, orgResult, templateResult, filterResult]) => {
      if (periodResult.error) setError(periodResult.error.message);
      const rows = (periodResult.data || []) as Period[];
      setPeriods(rows);
      if (rows[0]) setPeriod(rows[0].id);
      if (!orgResult.error) setIndustry(orgResult.data?.industry || "");
      if (!templateResult.error) setTemplates(templateResult.data || []);
      if (!filterResult.error) setOptions(filterResult.data || {});
      setLoading(false);
    });
  }, [supabase]);

  const activeTemplate = useMemo(() => templates.find((item) => item.template_key === template), [templates, template]);
  const preferredTerms = activeTemplate?.config?.preferred_terms || {};
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const accountItems = (options.accounts || []) as Option[];
  const filteredAccounts = useMemo(() => {
    const query = accountQuery.trim().toLocaleLowerCase("ar");
    return query ? accountItems.filter((item) => `${item.code || ""} ${item.name}`.toLocaleLowerCase("ar").includes(query)) : accountItems;
  }, [accountItems, accountQuery]);
  const currentField = fields.find((item) => item.key === filterField) || fields[0];
  const currentItems = (options[currentField.itemsKey] || []) as Option[];

  const chooseTemplate = (value: string) => { setTemplate(value); if (org) window.localStorage.setItem(`fpa:statement-template:${org}`, value); setData(null); };
  const chooseMethod = (value: string) => { setCashMethod(value); if (org) window.localStorage.setItem(`fpa:cash-method:${org}`, value); setData(null); };
  const clearFilters = () => { setFilters({ branch: "", department: "", cost_center: "", region: "", product: "", project: "", account: "" }); setAccountQuery(""); setData(null); };
  const addFilter = () => { if (!filterValue) return; setFilters((previous) => ({ ...previous, [filterField]: filterValue })); setFilterValue(""); setData(null); };

  async function load() {
    if (!org || !period) return;
    setRunning(true); setError("");
    const args = { p_organization_id: org, p_period_id: period, p_branch_id: filters.branch || null, p_department_id: filters.department || null, p_cost_center_id: filters.cost_center || null, p_region_id: filters.region || null, p_product_id: filters.product || null, p_project_id: filters.project || null, p_account_id: filters.account || null, p_cash_flow_method: cashMethod };
    const [statementResult, ociResult] = await Promise.all([
      supabase.rpc("get_financial_statements_v2", args),
      supabase.rpc("get_other_comprehensive_income", { p_organization_id: org, p_period_id: period, p_branch_id: filters.branch || null, p_department_id: filters.department || null, p_cost_center_id: filters.cost_center || null, p_region_id: filters.region || null, p_product_id: filters.product || null, p_project_id: filters.project || null }),
    ]);
    if (statementResult.error) { setError(statementResult.error.message); setData(null); } else setData(statementResult.data as FS);
    if (ociResult.error) { setOci(null); if (!statementResult.error) setError(`تعذر تحميل قائمة الدخل الشامل الآخر: ${ociResult.error.message}`); } else setOci(ociResult.data as OCI);
    setRunning(false);
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-[#172033]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/workspace" className="text-sm font-semibold text-slate-500">العودة لمساحة العمل</a>
          <div className="text-right"><p className="text-[10px] font-bold tracking-[.14em] text-slate-400">FINANCIAL REPORTING</p><h1 className="mt-1 font-bold text-slate-950">مركز القوائم المالية</h1></div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="border-b border-slate-200 pb-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold text-slate-400">{industry || "ملف النشاط"}</p><h2 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">القوائم المالية المترابطة</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">مسار موحد من القيود اليومية إلى القوائم المالية، مع فلاتر تحليلية وقوالب حسب النشاط وربط مباشر بين الربح وحقوق الملكية والنقدية.</p></div><div className="flex flex-wrap gap-2"><select value={template} onChange={(event) => chooseTemplate(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold"><option value="standard">القالب القياسي</option>{templates.filter((item) => item.template_key !== "standard").map((item) => <option key={item.template_key} value={item.template_key}>{item.name_ar}</option>)}</select><select value={cashMethod} onChange={(event) => chooseMethod(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold"><option value="indirect">التدفقات النقدية — غير مباشرة</option><option value="direct">التدفقات النقدية — مباشرة</option></select></div></div></div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1.45fr_1fr_auto_auto]"><select value={period} onChange={(event) => { setPeriod(event.target.value); setData(null); }} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold">{periods.map((item) => <option key={item.id} value={item.id}>{date(item.period_start)} — {date(item.period_end)}</option>)}</select><select value={filters.branch} onChange={(event) => { setFilters({ ...filters, branch: event.target.value }); setData(null); }} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"><option value="">كل الفروع</option>{(options.branches || []).map((item: Option) => <option key={item.id} value={item.id}>{item.code ? `${item.code} — ` : ""}{item.name}</option>)}</select><button onClick={() => setAdvanced((value) => !value)} className={`min-h-11 rounded-xl border px-4 text-sm font-bold ${advanced || activeFilterCount ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-800"}`}>الفلاتر {activeFilterCount ? `(${activeFilterCount})` : ""}</button><button disabled={!period || running} onClick={load} className="min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white disabled:opacity-50">{running ? "جاري الحساب..." : "تطبيق"}</button></div>
          {activeFilterCount > 0 && <div className="mt-3 flex flex-wrap items-center gap-2">{Object.entries(filters).filter(([, value]) => value).map(([key, value]) => { const field = fields.find((item) => item.key === key); const item = (options[field?.itemsKey || ""] || []).find((candidate: Option) => candidate.id === value); return <button key={key} onClick={() => setFilters({ ...filters, [key]: "" })} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{field?.label}: {item?.name || value} ×</button>; })}<button onClick={clearFilters} className="text-xs font-bold text-red-600">مسح الكل</button></div>}
          {advanced && <div className="mt-4 border-t border-slate-100 pt-4"><div className="grid gap-3 lg:grid-cols-[.8fr_1.5fr_auto]"><select value={filterField} onChange={(event) => { setFilterField(event.target.value); setFilterValue(""); }} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold">{fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select>{filterField === "account" ? <div className="relative"><input value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} placeholder="ابحث باسم أو كود الحساب" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />{accountQuery && <div className="absolute inset-x-0 top-12 z-20 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">{filteredAccounts.slice(0, 25).map((item) => <button type="button" key={item.id} onClick={() => { setFilterValue(item.id); setAccountQuery(`${item.code || ""} — ${item.name}`); }} className="block w-full px-3 py-2 text-right text-xs hover:bg-slate-50">{item.code} — {item.name}</button>)}</div>}</div> : <select value={filterValue} onChange={(event) => setFilterValue(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"><option value="">اختر قيمة الفلتر</option>{currentItems.map((item) => <option key={item.id} value={item.id}>{item.code ? `${item.code} — ` : ""}{item.name}</option>)}</select>}<button onClick={addFilter} className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold">+ إضافة فلتر</button></div><p className="mt-2 text-xs text-slate-400">الفلاتر تطبق بمنطق AND وعلى القيود المنشورة فقط.</p></div>}
        </div>

        {activeTemplate?.config?.preferred_terms && <p className="mt-3 text-xs font-semibold text-slate-500">مصطلحات القالب: {Object.values(preferredTerms).join(" · ")}</p>}

        {loading ? <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">جاري تحميل الفترات والقوالب والفلاتر...</div> : error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">{error}</div> : !data ? <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">اختر الفترة والفلاتر ثم اضغط تطبيق لعرض القوائم.</div> : (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metric label="الإيرادات" value={data.income_statement?.revenue} /><Metric label="مجمل الربح" value={data.income_statement?.gross_profit} /><Metric label="EBITDA" value={data.income_statement?.ebitda} /><Metric label="صافي الربح" value={data.income_statement?.net_income} /><Metric label="حقوق الملكية" value={data.balance_sheet?.total_equity} /><Metric label="النقدية آخر الفترة" value={data.cash_flow?.closing_cash} /></div>
            <div className={`mt-4 rounded-xl border p-4 text-sm font-bold ${Number(data.validation?.balance_sheet_difference || 0) === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>حالة النموذج: {Number(data.validation?.balance_sheet_difference || 0) === 0 ? "متوازن" : "يحتاج مراجعة"} · فرق المركز المالي: {money(data.validation?.balance_sheet_difference)} · صافي الربح YTD داخل حقوق الملكية: {money(data.balance_sheet?.ytd_net_income)}</div>
            <div className="mt-6 flex items-center gap-2"><button onClick={() => setActive((current) => statements[(statements.indexOf(current) - 1 + statements.length) % statements.length])} aria-label="القائمة السابقة" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-300 bg-white">←</button><div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">{statements.map((key) => <button key={key} onClick={() => setActive(key)} className={`min-w-[180px] rounded-xl border px-4 py-3 text-sm font-bold ${active === key ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"}`}>{statementNames[key]}</button>)}</div><button onClick={() => setActive((current) => statements[(statements.indexOf(current) + 1) % statements.length])} aria-label="القائمة التالية" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-300 bg-white">→</button></div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 border-b border-slate-100 pb-4"><h3 className="text-lg font-bold text-slate-950">{statementNames[active]}</h3></div>{active === "balance" && <Balance data={data.balance_sheet} />}{active === "income" && <Income data={data.income_statement} terms={preferredTerms} />}{active === "oci" && <OCIView data={oci} />}{active === "cash" && <CashFlow data={data.cash_flow} />}{active === "equity" && <Equity data={data.equity_statement} />}</div>
          </>
        )}
      </section>
    </main>
  );
}
