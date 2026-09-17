"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatMoneyMinor, formatPercent, formatDate } from "@/lib/format";
import { ReportDimensionFilters, emptyReportDimensionFilters, ReportDimensionFilterState } from "@/components/workspace/report-dimension-filters";

type Period = { id: string; period_start: string; period_end: string; status: string };
type Version = { id: string; name: string; status: string; version_type: string };
type Row = { account_id: string; code: string; name: string; account_type: string | null; actual_minor: number; budget_minor: number; forecast_minor: number; variance_vs_budget_minor: number; variance_vs_forecast_minor: number | null; variance_vs_budget_pct: number | null };
type Metric = { actual_minor: number; budget_minor: number; forecast_minor: number; variance_vs_budget_minor: number; variance_vs_forecast_minor: number | null };
type Result = { rows: Row[]; metrics: Record<string, Metric> };
type Option = { id: string; code?: string; name: string };
type Options = { branches: Option[]; departments: Option[]; cost_centers: Option[]; regions: Option[]; products: Option[]; projects: Option[]; accounts: Option[] };

const emptyOptions: Options = { branches: [], departments: [], cost_centers: [], regions: [], products: [], projects: [], accounts: [] };
const metricLabels: Record<string, string> = { revenue: "الإيرادات", cogs: "تكلفة المبيعات", gross_profit: "مجمل الربح", opex: "المصروفات التشغيلية", ebitda: "EBITDA" };
const expenseMetrics = new Set(["cogs", "opex"]);
const isFavorable = (key: string, value: number) => expenseMetrics.has(key) ? value <= 0 : value >= 0;
const sign = (value: number) => value > 0 ? "+" : "";
const RUN_DEBOUNCE_MS = 220;

export default function VariancePage() {
  const supabase = getSupabaseBrowserClient();
  const [org, setOrg] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [period, setPeriod] = useState("");
  const [budget, setBudget] = useState("");
  const [forecast, setForecast] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<Options>(emptyOptions);
  const [filters, setFilters] = useState<ReportDimensionFilterState>(emptyReportDimensionFilters);

  const selectedPeriod = useMemo(() => periods.find((p) => p.id === period), [periods, period]);
  const dateRange = useMemo(() => ({ start: selectedPeriod?.period_start ?? null, end: selectedPeriod?.period_end ?? null }), [selectedPeriod]);
  const approvedBudgets = useMemo(() => versions.filter((v) => v.version_type === "budget" && v.status === "approved"), [versions]);
  const approvedForecasts = useMemo(() => versions.filter((v) => v.version_type === "forecast" && v.status === "approved"), [versions]);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    const [{ data: p, error: pe }, { data: v, error: ve }, { data: f }] = await Promise.all([
      supabase.from("financial_periods").select("id,period_start,period_end,status").eq("organization_id", id).order("period_start"),
      supabase.from("planning_versions").select("id,name,status,version_type").eq("organization_id", id).in("version_type", ["budget", "forecast"]).order("created_at", { ascending: false }),
      supabase.rpc("get_reporting_filter_options", { p_organization_id: id }),
    ]);
    if (pe || ve) {
      setError((pe ?? ve)?.message ?? "تعذر تحميل بيانات المقارنة.");
    } else {
      const nextPeriods = (p ?? []) as Period[];
      const nextVersions = (v ?? []) as Version[];
      setPeriods(nextPeriods);
      setVersions(nextVersions);
      setPeriod((current) => current && nextPeriods.some((x) => x.id === current) ? current : nextPeriods[0]?.id ?? "");
      setBudget((current) => current && nextVersions.some((x) => x.id === current && x.version_type === "budget" && x.status === "approved") ? current : nextVersions.find((x) => x.version_type === "budget" && x.status === "approved")?.id ?? "");
      setForecast((current) => current && nextVersions.some((x) => x.id === current && x.version_type === "forecast" && x.status === "approved") ? current : nextVersions.find((x) => x.version_type === "forecast" && x.status === "approved")?.id ?? "");
      if (f) setOptions(f as Options);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const id = window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId");
    if (!id) { setError("لم يتم تحديد الشركة الحالية."); setLoading(false); return; }
    setOrg(id);
    void load(id);
  }, [load]);

  const run = useCallback(async () => {
    if (!org || !period || !budget) { setResult(null); return; }
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_variance_analysis_filtered", {
      p_organization_id: org,
      p_period_id: period,
      p_budget_version_id: budget,
      p_forecast_version_id: forecast || null,
      p_branch_id: filters.branch || null,
      p_department_id: filters.department || null,
      p_cost_center_id: filters.costCenter || null,
      p_region_id: filters.region || null,
      p_product_id: filters.product || null,
      p_project_id: filters.project || null,
      p_account_id: filters.account || null,
    });
    if (rpcError) { setError(rpcError.message); setResult(null); }
    else setResult((data ?? null) as Result | null);
    setBusy(false);
  }, [org, period, budget, forecast, filters, supabase]);

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => { void run(); }, RUN_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [loading, run]);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
          <p className="eyebrow">04 / VARIANCE</p>
          <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="section-title text-2xl sm:text-3xl">الفعلي مقابل الميزانية والتوقع</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">تحليل حتمي للانحرافات اعتمادًا على البيانات الفعلية المنشورة وإصدارات التخطيط المعتمدة.</p>
            </div>
            {busy && <span className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">جارٍ تحديث التحليل…</span>}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        {error && <div role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        <section className="saas-card p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div><p className="eyebrow">CONTROL BAR</p><h2 className="mt-1 text-base font-extrabold text-slate-950">نطاق المقارنة</h2><p className="mt-1 text-xs leading-6 text-slate-500">تتحدث النتائج تلقائيًا عند تغيير الفترة أو الإصدار أو أي بُعد.</p></div>
            <span className="hidden text-[10px] font-bold text-slate-400 sm:block">AUTO UPDATE</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <label className="text-[11px] font-bold text-slate-600">الفترة<select value={period} onChange={(e) => { setPeriod(e.target.value); setFilters(emptyReportDimensionFilters); }} className="input mt-1 w-full"><option value="">اختر الفترة</option>{periods.map((p) => <option key={p.id} value={p.id}>{formatDate(p.period_start)} → {formatDate(p.period_end)}</option>)}</select></label>
            <label className="text-[11px] font-bold text-slate-600">الميزانية المعتمدة<select value={budget} onChange={(e) => setBudget(e.target.value)} className="input mt-1 w-full"><option value="">الميزانية المعتمدة</option>{approvedBudgets.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
            <label className="text-[11px] font-bold text-slate-600">التوقع المعتمد<select value={forecast} onChange={(e) => setForecast(e.target.value)} className="input mt-1 w-full"><option value="">بدون توقع</option>{approvedForecasts.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
            <div className="flex items-end"><ReportDimensionFilters options={options} filters={filters} setFilters={setFilters} dateRange={dateRange} /></div>
          </div>
        </section>

        {result ? <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Object.entries(result.metrics).map(([key, metric]) => {
              const favorable = isFavorable(key, metric.variance_vs_budget_minor);
              return <article key={key} className="saas-card saas-card-hover p-5">
                <p className="eyebrow">{key.replace("_", " ")}</p>
                <h3 className="mt-1 text-sm font-extrabold text-slate-950">{metricLabels[key] ?? key}</h3>
                <p className="mt-4 text-xl font-black tabular-nums text-slate-950">{formatMoneyMinor(metric.actual_minor)} ريال</p>
                <p className="mt-1 text-[11px] text-slate-500">الميزانية {formatMoneyMinor(metric.budget_minor)} ريال</p>
                <p className={`mt-3 text-xs font-extrabold ${favorable ? "text-emerald-700" : "text-red-700"}`}>{sign(metric.variance_vs_budget_minor)}{formatMoneyMinor(metric.variance_vs_budget_minor)} ريال</p>
                <p className="mt-1 text-[10px] text-slate-400">الانحراف عن الميزانية</p>
              </article>;
            })}
          </section>

          <section className="saas-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><p className="eyebrow">ACCOUNT ANALYSIS</p><h2 className="mt-1 text-base font-extrabold text-slate-950">تحليل الحسابات</h2><p className="mt-1 text-xs text-slate-500">الانحراف = الفعلي − الميزانية. دلالة اللون تراعي طبيعة الحساب عند عرض الانحراف.</p></div>
            {result.rows.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">لا توجد حسابات ضمن نطاق المقارنة الحالي.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-right text-sm"><thead className="bg-slate-50 text-xs font-bold text-slate-500"><tr><th className="px-5 py-3">الحساب</th><th className="px-5 py-3">الفعلي</th><th className="px-5 py-3">الميزانية</th><th className="px-5 py-3">الانحراف</th><th className="px-5 py-3">%</th>{forecast && <th className="px-5 py-3">التوقع</th>}</tr></thead><tbody className="divide-y divide-slate-100">{result.rows.map((row) => { const favorable = expenseMetrics.has(row.account_type ?? "") ? row.variance_vs_budget_minor <= 0 : row.variance_vs_budget_minor >= 0; return <tr key={row.account_id} className="hover:bg-slate-50"><td className="px-5 py-4"><div className="font-semibold text-slate-950">{row.code} — {row.name}</div><div className="mt-1 text-[10px] text-slate-400">{row.account_type ?? "—"}</div></td><td className="px-5 py-4 font-bold tabular-nums">{formatMoneyMinor(row.actual_minor)}</td><td className="px-5 py-4 tabular-nums">{formatMoneyMinor(row.budget_minor)}</td><td className={`px-5 py-4 font-bold tabular-nums ${favorable ? "text-emerald-700" : "text-red-700"}`}>{sign(row.variance_vs_budget_minor)}{formatMoneyMinor(row.variance_vs_budget_minor)}</td><td className="px-5 py-4 tabular-nums">{formatPercent(row.variance_vs_budget_pct)}</td>{forecast && <td className="px-5 py-4 tabular-nums">{formatMoneyMinor(row.forecast_minor)}</td>}</tr>; })}</tbody></table></div>}
          </section>
        </> : <div className="border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">اختر فترة وميزانية معتمدة لعرض التحليل. لا توجد بيانات تجريبية.</div>}
      </div>
    </main>
  );
}
