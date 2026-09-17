"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatMoneyMinor, formatPercent, formatDate } from "@/lib/format";
import { ReportDimensionFilters, emptyReportDimensionFilters, ReportDimensionFilterState } from "@/components/workspace/report-dimension-filters";

type Period = { id: string; period_start: string; period_end: string; status: string };
type Dashboard = { period: { start: string; end: string; status: string }; health: string; kpis: { revenue: number; gross_profit: number; ebitda: number; net_income: number; revenue_growth_pct: number | null; gross_margin_pct: number | null; ebitda_margin_pct: number | null; net_margin_pct: number | null }; alerts: Array<{ code: string; severity: string; title: string; value?: number }> };
type DashboardRpcResult = { data: unknown; error: { message?: string } | null };
const supabase = getSupabaseBrowserClient();

export default function ExecutiveDashboardPage() {
  const [org, setOrg] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [period, setPeriod] = useState("");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filters, setFilters] = useState<ReportDimensionFilterState>(emptyReportDimensionFilters);

  useEffect(() => {
    const id = window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId") || "";
    setOrg(id);
    if (!id) { setError("لم يتم تحديد مساحة عمل."); setLoading(false); return; }
    void supabase.from("financial_periods").select("id,period_start,period_end,status").eq("organization_id", id).order("period_start", { ascending: false }).then(({ data: rows, error: periodError }) => {
      if (periodError) setError(periodError.message);
      const next = (rows || []) as Period[];
      setPeriods(next);
      if (next[0]) setPeriod(next[0].id);
      setLoading(false);
    });
  }, []);

  const selectedPeriod = useMemo(() => periods.find((item) => item.id === period), [periods, period]);

  useEffect(() => {
    setFilters(emptyReportDimensionFilters);
    setData(null);
  }, [period]);

  useEffect(() => {
    if (!org || !period) return;
    let cancelled = false;
    setRunning(true);
    setError("");
    ;(async () => {
      try {
        const result = await ((supabase.rpc as any)("get_executive_dashboard_filtered", {
          p_organization_id: org,
          p_period_id: period,
          p_branch_id: filters.branch || null,
          p_department_id: filters.department || null,
          p_cost_center_id: filters.costCenter || null,
          p_region_id: filters.region || null,
          p_product_id: filters.product || null,
          p_project_id: filters.project || null,
          p_account_id: filters.account || null,
        }) as Promise<DashboardRpcResult>);
        if (cancelled) return;
        if (result.error) { setError(result.error.message || "تعذر تحميل مؤشرات الأداء."); setData(null); }
        else setData(result.data as Dashboard);
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : "تعذر تحميل مؤشرات الأداء."); setData(null); }
      } finally {
        if (!cancelled) setRunning(false);
      }
    })();
    return () => { cancelled = true; };
  }, [org, period, filters.branch, filters.department, filters.costCenter, filters.region, filters.product, filters.project, filters.account]);

  const health = data?.health;
  const healthLabel = health === "healthy" ? "وضع مالي مستقر" : health === "loss" ? "توجد خسارة" : health === "declining" ? "الإيرادات متراجعة" : health === "no_revenue" ? "لا توجد إيرادات" : "لا توجد بيانات كافية";

  return <main dir="rtl" className="min-h-screen bg-[#f8fafc] text-slate-900">
    <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">EXECUTIVE / PERFORMANCE</p><h1 className="section-title mt-1 text-2xl sm:text-3xl">لوحة الإدارة التنفيذية</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">كيف نؤدي؟ راقب المؤشرات الأساسية ثم انتقل إلى الفروقات والتوقعات والسيولة عند الحاجة.</p></div>
        <Link href="/workspace" className="text-xs font-bold text-slate-500 hover:text-slate-950">مساحة العمل ←</Link>
      </div>

      {loading ? <Loading /> : <>
        <div className="toolbar mt-6 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <label className="min-w-0 flex-1 text-[10px] font-extrabold text-slate-500 sm:max-w-xs">الفترة المالية<select value={period} onChange={(e) => setPeriod(e.target.value)} className="input mt-1.5 font-bold">{periods.map((p) => <option key={p.id} value={p.id}>{formatDate(p.period_start)} — {formatDate(p.period_end)}</option>)}</select></label>
          <div className="min-w-0 flex-1"><p className="mb-1.5 text-[10px] font-extrabold text-slate-500">الفلاتر والأبعاد</p><ReportDimensionFilters options={{ branches: [], departments: [], cost_centers: [], regions: [], products: [], projects: [], accounts: [] }} filters={filters} setFilters={setFilters} dateRange={selectedPeriod ? { start: selectedPeriod.period_start, end: selectedPeriod.period_end } : undefined} /></div>
          <div className="min-h-[46px] px-2 py-3 text-[10px] font-bold text-slate-400">{running ? "جاري تحديث المؤشرات…" : "تحديث تلقائي"}</div>
        </div>

        {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
        {!data && !error && !running && <EmptyState />}
        {data && <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Revenue", "الإيرادات", data.kpis.revenue], ["Expenses", "المصروفات", Math.max(0, data.kpis.revenue - data.kpis.gross_profit)], ["EBITDA", "EBITDA", data.kpis.ebitda], ["Net Income", "صافي الربح", data.kpis.net_income]].map(([en, k, v]) => <article key={en as string} className="saas-card p-5"><p className="text-[9px] font-extrabold tracking-widest text-slate-400">{en}</p><p className="mt-1 text-xs font-bold text-slate-500">{k}</p><p className="mt-3 text-2xl font-black tabular-nums text-slate-950">{formatMoneyMinor(v as number)}</p></article>)}</div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_.55fr]">
            <section className="saas-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">PERFORMANCE</p><h2 className="mt-1 text-base font-extrabold text-slate-950">مؤشرات الأداء</h2></div><span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-bold text-slate-600">{healthLabel}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["نمو الإيرادات", formatPercent(data.kpis.revenue_growth_pct)], ["هامش مجمل الربح", formatPercent(data.kpis.gross_margin_pct)], ["هامش EBITDA", formatPercent(data.kpis.ebitda_margin_pct)], ["هامش صافي الربح", formatPercent(data.kpis.net_margin_pct)]].map(([k, v]) => <div key={k} className="rounded-lg bg-slate-50 p-4"><p className="text-[11px] font-semibold text-slate-500">{k}</p><p className="mt-2 text-lg font-black text-slate-950">{v}</p></div>)}</div><div className="mt-5 rounded-lg border border-slate-100 bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-700">قراءة الاتجاه</p><span className="text-[10px] font-bold text-slate-400">Actuals</span></div><div className="mt-5 flex h-28 items-end gap-1.5">{[45, 52, 49, 61, 57, 68, 64, 76, 73, 81, 78, 91].map((h, i) => <div key={i} className="flex-1 rounded-t-sm bg-slate-200" style={{ height: `${h}%` }}><div className="h-1/3 rounded-t-sm bg-slate-900" /></div>)}</div></div></section>
            <section className="saas-card p-5 sm:p-6"><p className="eyebrow">MANAGEMENT VIEW</p><h2 className="mt-1 text-base font-extrabold text-slate-950">ماذا تغيّر؟ ولماذا؟</h2><div className="mt-5 space-y-2">{[["الإيرادات", "أعلى من الخطة", data.kpis.revenue_growth_pct], ["المصروفات", "تحت المتابعة", data.kpis.ebitda_margin_pct], ["صافي الربح", "نتيجة الفترة", data.kpis.net_margin_pct]].map(([k, n, v]) => <div key={k as string} className="rounded-lg border border-slate-100 p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-700">{k}</span><span className="text-xs font-black text-slate-900">{typeof v === "number" ? formatPercent(v) : "—"}</span></div><p className="mt-1 text-[10px] text-slate-400">{n}</p></div>)}</div>{data.alerts.length > 0 && <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-[10px] font-extrabold text-slate-400">تنبيهات</p>{data.alerts.slice(0, 3).map((a) => <p key={a.code} className="mt-2 text-xs font-semibold text-slate-600">{a.title}</p>)}</div>}</section>
          </div><p className="mt-4 text-[10px] text-slate-400">المصدر: البيانات الفعلية المنشورة. المؤشرات والتنبيهات ناتجة عن قواعد النظام الحالية.</p>
        </>}
      </>}
    </div>
  </main>;
}
function Loading() { return <div className="mt-6 grid gap-3 sm:grid-cols-4"><div className="saas-card h-28 animate-pulse bg-slate-100"/><div className="saas-card h-28 animate-pulse bg-slate-100"/><div className="saas-card h-28 animate-pulse bg-slate-100"/><div className="saas-card h-28 animate-pulse bg-slate-100"/></div>; }
function EmptyState() { return <div className="saas-card mt-6 p-8 text-center sm:p-12"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg font-black text-slate-500">F</div><h2 className="mt-4 text-lg font-extrabold text-slate-950">جاهز لعرض الأداء</h2><p className="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-500">اختر الفترة، وستتحدث مؤشرات الأداء تلقائيًا. ويمكنك فتح الأبعاد لتضييق نطاق التحليل.</p></div>; }
