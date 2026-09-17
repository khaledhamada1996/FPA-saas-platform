"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatMoneyMinor, formatPercent, formatDate } from "@/lib/format";
import { ReportDimensionFilters, emptyReportDimensionFilters, ReportDimensionFilterState } from "@/components/workspace/report-dimension-filters";

type Period = { id: string; period_start: string; period_end: string; status: string };
type Dashboard = {
  period: { start: string; end: string; status: string };
  health: string;
  kpis: {
    revenue: number;
    gross_profit: number;
    ebitda: number;
    net_income: number;
    revenue_growth_pct: number | null;
    gross_margin_pct: number | null;
    ebitda_margin_pct: number | null;
    net_margin_pct: number | null;
  };
  alerts: Array<{ code: string; severity: string; title: string; value?: number }>;
};
type DashboardRpcResult = { data: unknown; error: { message?: string } | null };
const supabase = getSupabaseBrowserClient();

const Icon = ({ name, size = 18 }: { name: "trend" | "wallet" | "chart" | "profit" | "bell" | "arrow" | "target" | "alert" | "spark"; size?: number }) => {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "trend") return <svg {...common}><path d="M3 17 9 11l4 4 8-9"/><path d="M15 6h6v6"/></svg>;
  if (name === "wallet") return <svg {...common}><path d="M4 7.5h15a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13"/><path d="M16 13h5"/><circle cx="16" cy="13" r=".7" fill="currentColor"/></svg>;
  if (name === "chart") return <svg {...common}><path d="M4 19V5"/><path d="M4 19h17"/><path d="m7 15 3-4 3 2 5-7"/></svg>;
  if (name === "profit") return <svg {...common}><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19V3"/></svg>;
  if (name === "bell") return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>;
  if (name === "target") return <svg {...common}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m15 9 4-4"/></svg>;
  if (name === "alert") return <svg {...common}><path d="m10.3 3.6-7 12.2A2 2 0 0 0 5 18.8h14a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 16h.01"/></svg>;
  return <svg {...common}><path d="M12 3v18"/><path d="M3 12h18"/><path d="m5 5 14 14"/><path d="m19 5-14 14"/></svg>;
};

function formatDelta(value: number | null) {
  return value == null ? "—" : formatPercent(value);
}

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
  const healthLabel = health === "healthy" ? "أداء مستقر" : health === "loss" ? "خسارة في الفترة" : health === "declining" ? "الإيرادات متراجعة" : health === "no_revenue" ? "لا توجد إيرادات" : "بيانات غير كافية";
  const healthTone = health === "loss" || health === "declining" ? "text-rose-600 bg-rose-50 border-rose-100" : health === "healthy" ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-amber-700 bg-amber-50 border-amber-100";

  return <main dir="rtl" className="min-h-screen bg-[#f5f8fc] text-slate-900">
    <div className="mx-auto max-w-[1560px] px-3 py-4 sm:px-5 lg:px-7 lg:py-6">
      <header className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <Link href="/workspace" className="flex items-center gap-2 text-sm font-black text-[#173b73]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#173b73] text-white"><Icon name="chart" size={16} /></span>
            <span>القائد <span className="font-normal text-slate-400">FP&A</span></span>
          </Link>
          <div className="hidden h-6 w-px bg-slate-200 sm:block" />
          <div className="relative min-w-[210px] flex-1 max-w-xl">
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="chart" size={15} /></span>
            <span className="block h-9 rounded-lg border border-slate-200 bg-slate-50 px-9 py-2 text-xs text-slate-400">ابحث في مساحة العمل...</span>
          </div>
          <div className="mr-auto flex items-center gap-2">
            <button type="button" aria-label="التنبيهات" className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"><Icon name="bell" size={16} />{data?.alerts?.length ? <span className="absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white">{data.alerts.length}</span> : null}</button>
            <div className="hidden items-center gap-2 border-r border-slate-200 pr-3 sm:flex"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#173b73] to-[#38bdf8] text-xs font-black text-white">خ</span><div><p className="text-[11px] font-extrabold text-slate-800">المستخدم</p><p className="text-[9px] text-slate-400">إدارة مالية</p></div></div>
          </div>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="mb-1 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-400" /><span className="text-[10px] font-extrabold tracking-[0.18em] text-slate-400">EXECUTIVE / PERFORMANCE</span></div><h1 className="text-2xl font-black tracking-tight text-[#102d59] sm:text-[30px]">لوحة الإدارة التنفيذية</h1><p className="mt-1 text-xs leading-5 text-slate-500">صورة مركزة لأداء المنشأة المالي خلال الفترة المحددة</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 min-w-[190px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-500"><Icon name="target" size={15} /><select value={period} onChange={(e) => setPeriod(e.target.value)} className="min-w-0 flex-1 bg-transparent text-xs font-extrabold text-slate-700 outline-none">{periods.map((p) => <option key={p.id} value={p.id}>{formatDate(p.period_start)} — {formatDate(p.period_end)}</option>)}</select></label>
          </div>
        </div>
      </header>

      {loading ? <Loading /> : <>
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center"><div className="shrink-0 text-[10px] font-black text-slate-500">تصفية البيانات</div><div className="min-w-0 flex-1"><ReportDimensionFilters options={{ branches: [], departments: [], cost_centers: [], regions: [], products: [], projects: [], accounts: [] }} filters={filters} setFilters={setFilters} dateRange={selectedPeriod ? { start: selectedPeriod.period_start, end: selectedPeriod.period_end } : undefined} /></div><span className="shrink-0 text-[9px] font-bold text-slate-400">{running ? "جارٍ التحديث..." : "محدث تلقائيًا"}</span></div>
        </section>

        {error && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}
        {!data && !error && !running && <EmptyState />}
        {data && <>
          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="الإيرادات" en="Revenue" value={data.kpis.revenue} delta={data.kpis.revenue_growth_pct} icon="trend" tone="blue" />
            <KpiCard label="مجمل الربح" en="Gross Profit" value={data.kpis.gross_profit} delta={data.kpis.gross_margin_pct} icon="wallet" tone="violet" />
            <KpiCard label="EBITDA" en="Operating Performance" value={data.kpis.ebitda} delta={data.kpis.ebitda_margin_pct} icon="chart" tone="cyan" />
            <KpiCard label="صافي الربح" en="Net Income" value={data.kpis.net_income} delta={data.kpis.net_margin_pct} icon="profit" tone="emerald" />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="space-y-4">
              <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5"><div><p className="text-[9px] font-black tracking-[0.16em] text-slate-400">FINANCIAL PERFORMANCE</p><h2 className="mt-1 text-sm font-black text-[#102d59]">أداء الفترة</h2></div><div className={`rounded-full border px-3 py-1.5 text-[10px] font-extrabold ${healthTone}`}>{healthLabel}</div></div>
                <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
                  <Metric label="نمو الإيرادات" value={formatDelta(data.kpis.revenue_growth_pct)} sub="مقارنة بالفترة المرجعية" icon="trend" />
                  <Metric label="هامش مجمل الربح" value={formatDelta(data.kpis.gross_margin_pct)} sub="Gross Margin" icon="wallet" />
                  <Metric label="هامش EBITDA" value={formatDelta(data.kpis.ebitda_margin_pct)} sub="Operating Margin" icon="chart" />
                  <Metric label="هامش صافي الربح" value={formatDelta(data.kpis.net_margin_pct)} sub="Net Margin" icon="profit" />
                </div>
                <div className="px-4 pb-5 sm:px-5"><div className="rounded-xl bg-[#f7faff] p-4"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black text-slate-700">مؤشرات الربحية</p><p className="mt-1 text-[10px] text-slate-400">القيم الحالية المشتقة من القوائم الفعلية المنشورة</p></div><span className="rounded-md bg-white px-2 py-1 text-[9px] font-black text-[#3478c9] shadow-sm">ACTUALS</span></div><div className="space-y-3"><ProgressRow label="هامش مجمل الربح" value={data.kpis.gross_margin_pct} /><ProgressRow label="هامش EBITDA" value={data.kpis.ebitda_margin_pct} /><ProgressRow label="هامش صافي الربح" value={data.kpis.net_margin_pct} /></div></div></div>
              </article>

              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black tracking-[0.16em] text-slate-400">PROFITABILITY</p><h2 className="mt-1 text-sm font-black text-[#102d59]">توزيع النتائج المالية</h2></div><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Icon name="profit" size={15} /></span></div><div className="mt-5 flex items-center gap-5"><MarginRing label="صافي الربح" value={data.kpis.net_margin_pct} /><div className="min-w-0 flex-1 space-y-3"><MiniValue label="الإيرادات" value={data.kpis.revenue} /><MiniValue label="مجمل الربح" value={data.kpis.gross_profit} /><MiniValue label="EBITDA" value={data.kpis.ebitda} /></div></div></article>
                <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black tracking-[0.16em] text-slate-400">MANAGEMENT VIEW</p><h2 className="mt-1 text-sm font-black text-[#102d59]">قراءة الإدارة</h2></div><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600"><Icon name="spark" size={15} /></span></div><div className="mt-4 space-y-2"><InsightRow label="الإيرادات" value={formatDelta(data.kpis.revenue_growth_pct)} tone="blue" /><InsightRow label="الربحية الإجمالية" value={formatDelta(data.kpis.gross_margin_pct)} tone="violet" /><InsightRow label="الربحية التشغيلية" value={formatDelta(data.kpis.ebitda_margin_pct)} tone="cyan" /><InsightRow label="النتيجة النهائية" value={formatDelta(data.kpis.net_margin_pct)} tone="emerald" /></div></article>
              </div>
            </div>

            <aside className="space-y-4">
              <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="bg-gradient-to-br from-[#153d78] via-[#1768ad] to-[#12b8c7] p-5 text-white"><div className="flex items-start justify-between"><div><p className="text-[9px] font-black tracking-[0.18em] text-white/65">FINANCIAL HEALTH</p><h2 className="mt-1 text-lg font-black">ملخص الحالة المالية</h2></div><span className="rounded-lg bg-white/15 p-2"><Icon name="target" size={18} /></span></div><p className="mt-5 text-3xl font-black">{healthLabel}</p><p className="mt-2 text-[10px] leading-5 text-white/75">الحالة مبنية على قواعد مؤشرات الأداء الحالية، وليست تقييمًا ائتمانيًا.</p></div><div className="p-4"><Link href="/workspace/financial-statements" className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#173b73] text-xs font-black text-white transition hover:bg-[#102d59]">فتح القوائم المالية <Icon name="arrow" size={14} /></Link></div></article>
              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black tracking-[0.16em] text-slate-400">ALERT CENTER</p><h2 className="mt-1 text-sm font-black text-[#102d59]">التنبيهات</h2></div><span className="text-[10px] font-bold text-slate-400">{data.alerts.length} عناصر</span></div>{data.alerts.length ? <div className="mt-3 space-y-2">{data.alerts.slice(0, 5).map((alert) => <div key={alert.code} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3"><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${alert.severity === "high" ? "bg-rose-100 text-rose-600" : alert.severity === "medium" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}><Icon name="alert" size={14} /></span><div className="min-w-0"><p className="text-[11px] font-extrabold text-slate-700">{alert.title}</p>{typeof alert.value === "number" && <p className="mt-1 text-[10px] text-slate-400">{formatMoneyMinor(alert.value)}</p>}</div></div>)}</div> : <div className="mt-3 rounded-lg bg-emerald-50 p-4 text-center text-xs font-bold text-emerald-700">لا توجد تنبيهات مسجلة للفترة</div>}</article>
              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[9px] font-black tracking-[0.16em] text-slate-400">QUICK ACTIONS</p><h2 className="mt-1 text-sm font-black text-[#102d59]">الوصول السريع</h2><div className="mt-3 grid gap-2"><QuickLink href="/workspace/variance" label="تحليل الفروقات" icon="chart" /><QuickLink href="/workspace/forecast" label="التوقعات المالية" icon="trend" /><QuickLink href="/workspace/cash" label="التدفقات النقدية" icon="wallet" /></div></article>
            </aside>
          </section>
          <p className="mt-4 text-[9px] text-slate-400">المصدر: البيانات الفعلية المنشورة. لا يتم إنشاء قيم شهرية أو رسوم وهمية؛ العناصر المرئية أعلاه مشتقة من مؤشرات الفترة الحالية.</p>
        </>}
      </>}
    </div>
  </main>;
}

function KpiCard({ label, en, value, delta, icon, tone }: { label: string; en: string; value: number; delta: number | null; icon: "trend" | "wallet" | "chart" | "profit"; tone: "blue" | "violet" | "cyan" | "emerald" }) {
  const styles = { blue: "bg-blue-50 text-blue-600", violet: "bg-violet-50 text-violet-600", cyan: "bg-cyan-50 text-cyan-600", emerald: "bg-emerald-50 text-emerald-600" };
  return <article className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black tracking-[0.15em] text-slate-400">{en}</p><p className="mt-1 text-xs font-extrabold text-slate-500">{label}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${styles[tone]}`}><Icon name={icon} size={17} /></span></div><p className="mt-4 text-[22px] font-black tracking-tight text-[#102d59] tabular-nums">{formatMoneyMinor(value)}</p><div className="mt-3 flex items-center gap-2"><span className={`flex items-center gap-1 text-[10px] font-black ${delta != null && delta < 0 ? "text-rose-600" : "text-emerald-600"}`}><Icon name="trend" size={12} />{formatDelta(delta)}</span><span className="text-[9px] text-slate-400">مؤشر الفترة</span></div></article>;
}

function Metric({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: "trend" | "wallet" | "chart" | "profit" }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#2876c5] shadow-sm"><Icon name={icon} size={13} /></span><p className="mt-3 text-[10px] font-bold text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-[#102d59]">{value}</p><p className="mt-1 text-[8px] text-slate-400">{sub}</p></div>;
}

function ProgressRow({ label, value }: { label: string; value: number | null }) {
  const numeric = value == null ? 0 : Math.max(0, Math.min(100, value));
  return <div><div className="mb-1.5 flex items-center justify-between text-[10px]"><span className="font-bold text-slate-600">{label}</span><span className="font-black text-slate-700">{formatDelta(value)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-l from-[#14b8c8] to-[#3478d1] transition-all duration-500" style={{ width: `${numeric}%` }} /></div></div>;
}

function MarginRing({ label, value }: { label: string; value: number | null }) {
  const numeric = value == null ? 0 : Math.max(0, Math.min(100, value));
  const dash = 2 * Math.PI * 37;
  return <div className="relative h-28 w-28 shrink-0"><svg viewBox="0 0 100 100" className="h-full w-full -rotate-90"><circle cx="50" cy="50" r="37" fill="none" stroke="#e8eef6" strokeWidth="9"/><circle cx="50" cy="50" r="37" fill="none" stroke="#7c5cff" strokeWidth="9" strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={dash - (dash * numeric) / 100}/></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><strong className="text-lg font-black text-[#102d59]">{formatDelta(value)}</strong><span className="text-[8px] font-bold text-slate-400">{label}</span></div></div>;
}

function MiniValue({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0"><span className="text-[10px] font-bold text-slate-500">{label}</span><span className="text-[10px] font-black text-slate-800 tabular-nums">{formatMoneyMinor(value)}</span></div>; }

function InsightRow({ label, value, tone }: { label: string; value: string; tone: "blue" | "violet" | "cyan" | "emerald" }) { const dots = { blue: "bg-blue-500", violet: "bg-violet-500", cyan: "bg-cyan-500", emerald: "bg-emerald-500" }; return <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${dots[tone]}`} /><span className="text-[10px] font-bold text-slate-600">{label}</span></div><span className="text-[10px] font-black text-slate-800">{value}</span></div>; }

function QuickLink({ href, label, icon }: { href: string; label: string; icon: "chart" | "trend" | "wallet" }) { return <Link href={href} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-[10px] font-extrabold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#173b73]"><span className="flex items-center gap-2"><span className="text-blue-600"><Icon name={icon} size={14} /></span>{label}</span><Icon name="arrow" size={13} /></Link>; }

function Loading() { return <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white"/><div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white"/><div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white"/><div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white"/></div>; }
function EmptyState() { return <div className="mt-4 rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon name="chart" size={22} /></div><h2 className="mt-4 text-lg font-black text-[#102d59]">جاهز لعرض الأداء</h2><p className="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-500">اختر الفترة، وستتحدث مؤشرات الأداء تلقائيًا. ويمكنك استخدام الأبعاد لتضييق نطاق التحليل.</p></div>; }
