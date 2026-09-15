"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatMoneyMinor, formatDate } from "@/lib/format";
import { ReportDateFilter } from "@/components/workspace/report-date-filter";

type Option = { id: string; code?: string | null; name: string };
type FilterState = { branch: string; department: string; costCenter: string; region: string; product: string; project: string; account: string };
type FilterOptions = { branches: Option[]; departments: Option[]; regions: Option[]; products: Option[]; projects: Option[]; accounts: Option[]; cost_centers: Option[] };
type TrialRow = { code: string; name: string; account_type: string | null; statement_subclassification: string | null; opening_debit: number; opening_credit: number; period_debit: number; period_credit: number; closing_debit: number; closing_credit: number };
type TrialBalance = { period_start: string; period_end: string; fiscal_year_start: string; row_count: number; total_period_debit: number; total_period_credit: number; period_difference: number; total_opening_debit: number; total_opening_credit: number; opening_difference: number; total_closing_debit: number; total_closing_credit: number; closing_difference: number; rows: TrialRow[] };

const supabase = getSupabaseBrowserClient();
const emptyFilters: FilterState = { branch: "", department: "", costCenter: "", region: "", product: "", project: "", account: "" };
const emptyOptions: FilterOptions = { branches: [], departments: [], cost_centers: [], regions: [], products: [], projects: [], accounts: [] };

export default function TrialBalancePage() {
  const [org, setOrg] = useState("");
  const [range, setRange] = useState({ start: "", end: "" });
  const [dataRange, setDataRange] = useState({ min: "", max: "" });
  const [options, setOptions] = useState<FilterOptions>(emptyOptions);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [data, setData] = useState<TrialBalance | null>(null);
  const [query, setQuery] = useState("");
  const [openFilters, setOpenFilters] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!openFilters) return;
    const onPointerDown = (event: PointerEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setOpenFilters(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenFilters(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [openFilters]);

  useEffect(() => {
    const id = window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId") || "";
    setOrg(id);
    if (!id) { setLoading(false); setError("لم يتم تحديد مساحة عمل."); return; }
    void Promise.all([
      supabase.rpc("get_reporting_filter_options", { p_organization_id: id }),
      supabase.rpc("get_financial_data_date_range", { p_organization_id: id }),
    ]).then(([f, r]) => {
      if (f.error) setError(f.error.message);
      else setOptions({ ...emptyOptions, ...(f.data || {}) });
      if (r.error) setError(prev => prev || r.error.message);
      else {
        const min = r.data?.min_date || "";
        const max = r.data?.max_date || "";
        setDataRange({ min, max });
        if (min && max) setRange({ start: min, end: max });
      }
      setLoading(false);
    });
  }, []);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const accounts = options.accounts || [];
  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ar");
    return q ? accounts.filter(a => `${a.code || ""} ${a.name}`.toLocaleLowerCase("ar").includes(q)) : accounts;
  }, [accounts, query]);

  async function load() {
    if (!org || !range.start || !range.end) return;
    setRunning(true); setError("");
    const { data: result, error: e } = await supabase.rpc("get_trial_balance_date_range_filtered", {
      p_organization_id: org,
      p_start_date: range.start,
      p_end_date: range.end,
      p_branch_id: filters.branch || null,
      p_department_id: filters.department || null,
      p_cost_center_id: filters.costCenter || null,
      p_region_id: filters.region || null,
      p_product_id: filters.product || null,
      p_project_id: filters.project || null,
      p_account_id: filters.account || null,
    });
    if (e) { setError(e.message); setData(null); } else setData(result as TrialBalance);
    setRunning(false);
  }

  useEffect(() => { if (org && range.start && range.end) void load(); }, [org, range.start, range.end, filters.branch, filters.department, filters.costCenter, filters.region, filters.product, filters.project, filters.account]);

  const clear = () => { setFilters(emptyFilters); setQuery(""); };
  const setFilter = (key: keyof FilterState, value: string) => setFilters(prev => ({ ...prev, [key]: value }));

  return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-[#172033]">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8"><a href="/workspace" className="text-sm font-semibold text-slate-500">العودة لمساحة العمل</a><div><p className="text-[10px] font-bold tracking-[.14em] text-slate-400">FINANCIAL MODEL</p><h1 className="mt-1 font-bold text-slate-950">ميزان المراجعة</h1></div></div></header>
    <section className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6"><p className="text-xs font-bold text-slate-400">Trial Balance</p><h2 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">ميزان المراجعة الفعلي</h2><p className="mt-2 text-sm leading-6 text-slate-500">عرض الافتتاحي وحركة الفترة والختامي مع نفس فلتر التاريخ والأبعاد المستخدم في القوائم المالية.</p></div>
      <div ref={filterRef} className="mt-5 border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center gap-2"><ReportDateFilter value={range} onChange={v => { setRange(v); setData(null); }} minDate={dataRange.min} maxDate={dataRange.max} /><button type="button" onClick={() => setOpenFilters(v => !v)} className={`min-h-9 border px-3 text-xs font-bold ${activeFilterCount ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white"}`}>الأبعاد{activeFilterCount ? ` · ${activeFilterCount}` : ""}⌄</button><button type="button" disabled={!range.start || !range.end || running} onClick={() => void load()} className="min-h-9 bg-slate-950 px-4 text-xs font-bold text-white disabled:opacity-50">{running ? "جاري..." : "تطبيق"}</button></div>
        {activeFilterCount > 0 && <div className="mt-3 flex flex-wrap gap-2">{Object.entries(filters).filter(([, v]) => v).map(([k]) => <button key={k} type="button" onClick={() => setFilter(k as keyof FilterState, "")} className="bg-slate-100 px-3 py-1.5 text-xs font-semibold">{({ branch: "الفرع", department: "القسم", costCenter: "مركز التكلفة", region: "المنطقة", product: "المنتج", project: "المشروع", account: "الحساب" } as Record<string, string>)[k]} ×</button>)}<button type="button" onClick={clear} className="text-xs font-bold text-red-600">مسح الكل</button></div>}
        {openFilters && <div className="mt-4 border-t border-slate-100 pt-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold">أبعاد التقرير</span><button type="button" onClick={clear} className="text-[11px] font-bold text-slate-500">مسح الكل</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([["branch","الفرع",options.branches],["department","القسم",options.departments],["costCenter","مركز التكلفة",options.cost_centers],["region","المنطقة",options.regions],["product","المنتج",options.products],["project","المشروع",options.projects]] as [keyof FilterState,string,Option[]][]).map(([key,label,items]) => <label key={key} className="text-[11px] font-bold text-slate-500">{label}<select value={filters[key]} onChange={e => setFilter(key,e.target.value)} className="mt-1 min-h-9 w-full border border-slate-300 bg-white px-2 text-xs"><option value="">الكل</option>{items.map(x => <option key={x.id} value={x.id}>{x.code ? `${x.code} — ` : ""}{x.name}</option>)}</select></label>)}<div className="relative"><label className="text-[11px] font-bold text-slate-500">الحساب<input value={query} onChange={e => { setQuery(e.target.value); if (!e.target.value) setFilter("account", ""); }} placeholder="ابحث بالكود أو الاسم" className="mt-1 min-h-9 w-full border border-slate-300 bg-white px-2 text-xs" /></label>{query && <div className="absolute right-0 top-14 z-20 max-h-48 w-full overflow-auto border border-slate-200 bg-white shadow-lg">{filteredAccounts.slice(0, 30).map(a => <button type="button" key={a.id} onClick={() => { setFilter("account", a.id); setQuery(`${a.code || ""} — ${a.name}`); }} className="block w-full px-3 py-2 text-right text-xs hover:bg-slate-50">{a.code} — {a.name}</button>)}</div>}</div></div><p className="mt-3 text-[10px] leading-5 text-slate-400">الأبعاد تطبق على البيانات الفعلية المنشورة والتقرير بالكامل.</p></div>}
      </div>
      {loading ? <div className="mt-7 border border-slate-200 bg-white p-8 text-sm text-slate-500">جاري تحميل البيانات...</div> : error ? <div className="mt-5 border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : !data ? <div className="mt-7 border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">اختر الفترة لعرض الميزان.</div> : <><div className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6"><Metric label="مدين الفترة" value={data.total_period_debit}/><Metric label="دائن الفترة" value={data.total_period_credit}/><Metric label="فرق الفترة" value={data.period_difference} good={data.period_difference===0}/><Metric label="فرق الافتتاح" value={data.opening_difference} good={data.opening_difference===0}/><Metric label="فرق الإغلاق" value={data.closing_difference} good={data.closing_difference===0}/><Metric label="عدد الحسابات" value={data.row_count} raw/></div><div className="mt-5 overflow-hidden border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-right text-sm"><thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="sticky right-0 bg-slate-50 px-4 py-3">الحساب</th><th className="px-4 py-3">التصنيف</th><th className="px-4 py-3">افتتاحي مدين</th><th className="px-4 py-3">افتتاحي دائن</th><th className="px-4 py-3">حركة مدين</th><th className="px-4 py-3">حركة دائن</th><th className="px-4 py-3">ختامي مدين</th><th className="px-4 py-3">ختامي دائن</th></tr></thead><tbody>{data.rows.map(r => <tr key={r.code} className="border-b border-slate-100 hover:bg-slate-50"><td className="sticky right-0 bg-white px-4 py-3 font-semibold text-slate-900">{r.code} — {r.name}</td><td className="px-4 py-3 text-xs text-slate-500">{r.statement_subclassification || r.account_type || "غير مصنف"}</td><td className="px-4 py-3 tabular-nums">{formatMoneyMinor(r.opening_debit)}</td><td className="px-4 py-3 tabular-nums">{formatMoneyMinor(r.opening_credit)}</td><td className="px-4 py-3 tabular-nums">{formatMoneyMinor(r.period_debit)}</td><td className="px-4 py-3 tabular-nums">{formatMoneyMinor(r.period_credit)}</td><td className="px-4 py-3 tabular-nums">{formatMoneyMinor(r.closing_debit)}</td><td className="px-4 py-3 tabular-nums">{formatMoneyMinor(r.closing_credit)}</td></tr>)}</tbody></table></div><div className="border-t border-slate-200 px-4 py-4 text-xs font-semibold text-slate-500">من {formatDate(data.period_start)} إلى {formatDate(data.period_end)} · السنة المالية تبدأ في {formatDate(data.fiscal_year_start)} · البيانات فعلية ومنشورة فقط</div></div></>}</section>
  </main>;
}

function Metric({ label, value, good = true, raw = false }: { label: string; value: number; good?: boolean; raw?: boolean }) { return <div className="border border-slate-200 bg-white p-4"><p className="text-[11px] font-bold text-slate-400">{label}</p><p className={`mt-2 text-lg font-bold ${good ? "text-slate-950" : "text-red-700"}`}>{raw ? Math.round(Number(value || 0)).toLocaleString("en-US") : formatMoneyMinor(value)}</p></div>; }
