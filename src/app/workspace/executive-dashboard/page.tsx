"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatMoneyMinor, formatPercent } from "@/lib/format";
import { ReportDateFilter, getDefaultReportDateRange, type ReportDateRange } from "@/components/reporting/date-range-filter";
import { ReportDimensionFilters, emptyReportDimensionFilters, type ReportDimensionFilterState } from "@/components/workspace/report-dimension-filters";

type Dashboard = {
  period: { start: string; end: string };
  comparison: { start: string; end: string } | null;
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
type RpcResult = { data: unknown; error: { message?: string } | null };

type SearchItem = { title: string; subtitle: string; href: string };
const searchItems: SearchItem[] = [
  { title: "لوحة الإدارة التنفيذية", subtitle: "الأداء والمؤشرات المالية", href: "/workspace/executive-dashboard" },
  { title: "القوائم المالية", subtitle: "المركز المالي والربح والتدفقات النقدية", href: "/workspace/financial-statements" },
  { title: "ميزان المراجعة", subtitle: "الأرصدة والحركات المحاسبية", href: "/workspace/trial-balance" },
  { title: "البيانات الفعلية", subtitle: "استيراد ومراجعة البيانات", href: "/workspace/actuals" },
  { title: "الميزانية", subtitle: "التخطيط المالي", href: "/workspace/budget" },
  { title: "التوقعات", subtitle: "الرؤية المستقبلية", href: "/workspace/forecast" },
  { title: "الفروقات", subtitle: "Actual مقابل Budget وForecast", href: "/workspace/variance" },
  { title: "التدفق النقدي", subtitle: "السيولة الداخلة والخارجة", href: "/workspace/cash" },
  { title: "التحليل المالي", subtitle: "الهوامش والنسب والأداء", href: "/workspace/financial-analysis" },
  { title: "السيناريوهات", subtitle: "What If وتحليل البدائل", href: "/workspace/scenarios" },
  { title: "التقارير", subtitle: "التقارير المالية والإدارية", href: "/workspace/reports" },
  { title: "الفريق والصلاحيات", subtitle: "إدارة المستخدمين والصلاحيات", href: "/workspace/team" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (v: string) => { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d: Date, n: number) => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() + n); return r; };

function getPreviousComparisonRange(startValue: string, endValue: string) {
  const start = fromIso(startValue);
  const end = fromIso(endValue);
  const fullMonth = start.getDate() === 1 && end.getFullYear() === start.getFullYear() && end.getMonth() === start.getMonth() && end.getDate() === new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const fullYear = start.getMonth() === 0 && start.getDate() === 1 && end.getFullYear() === start.getFullYear() && end.getMonth() === 11 && end.getDate() === 31;
  if (fullMonth) {
    const previousStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    const previousEnd = new Date(start.getFullYear(), start.getMonth(), 0);
    return { start: toIso(previousStart), end: toIso(previousEnd) };
  }
  if (fullYear) {
    const y = start.getFullYear() - 1;
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  return { start: toIso(addDays(start, -days)), end: toIso(addDays(start, -1)) };
}

function Icon({ name, size = 17 }: { name: "search" | "bell" | "chart" | "arrow" | "alert" | "trend" | "wallet" | "profit"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></svg>;
  if (name === "bell") return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
  if (name === "chart") return <svg {...common}><path d="M4 19V5" /><path d="M4 19h17" /><path d="m7 15 3-4 3 2 5-7" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>;
  if (name === "alert") return <svg {...common}><path d="m10.3 3.6-7 12.2A2 2 0 0 0 5 18.8h14a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 16h.01" /></svg>;
  if (name === "trend") return <svg {...common}><path d="M3 17 9 11l4 4 8-9" /><path d="M15 6h6v6" /></svg>;
  if (name === "wallet") return <svg {...common}><path d="M4 7.5h15a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" /><path d="M16 13h5" /><circle cx="16" cy="13" r=".7" fill="currentColor" /></svg>;
  return <svg {...common}><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19V3" /></svg>;
}

function ComparisonMenu({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="relative">
    <button type="button" onClick={() => setOpen(v => !v)} className={`erp-button ${value ? "erp-button-primary" : ""}`}>المقارنة {value ? "· الفترة السابقة" : "· بدون مقارنة"}⌄</button>
    {open && <div className="erp-panel absolute right-0 top-9 z-50 w-52 p-1">
      <button type="button" onClick={() => { onChange(false); setOpen(false); }} className="block w-full border-b border-slate-100 px-3 py-2.5 text-right text-xs font-semibold hover:bg-slate-50">بدون مقارنة</button>
      <button type="button" onClick={() => { onChange(true); setOpen(false); }} className="block w-full px-3 py-2.5 text-right text-xs font-semibold hover:bg-slate-50">الفترة السابقة</button>
    </div>}
  </div>;
}

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [org, setOrg] = useState("");
  const [dateRange, setDateRange] = useState<ReportDateRange>(() => getDefaultReportDateRange("year"));
  const [compare, setCompare] = useState(false);
  const [filters, setFilters] = useState<ReportDimensionFilterState>(emptyReportDimensionFilters);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const comparisonRange = useMemo(() => compare && dateRange.start && dateRange.end ? getPreviousComparisonRange(dateRange.start, dateRange.end) : null, [compare, dateRange.start, dateRange.end]);
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchItems.filter(item => `${item.title} ${item.subtitle}`.toLowerCase().includes(q)).slice(0, 6);
  }, [query]);

  useEffect(() => {
    const id = window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId") || "";
    setOrg(id);
    if (!id) { setError("لم يتم تحديد مساحة العمل."); setLoading(false); }
  }, []);

  useEffect(() => {
    setFilters(emptyReportDimensionFilters);
  }, [dateRange.start, dateRange.end]);

  useEffect(() => {
    if (!org || !dateRange.start || !dateRange.end) return;
    let cancelled = false;
    setRunning(true);
    setError("");
    void (async () => {
      try {
        const result = await ((supabase.rpc as any)("get_executive_dashboard_date_range_filtered", {
          p_organization_id: org,
          p_start_date: dateRange.start,
          p_end_date: dateRange.end,
          p_branch_id: filters.branch || null,
          p_department_id: filters.department || null,
          p_cost_center_id: filters.costCenter || null,
          p_region_id: filters.region || null,
          p_product_id: filters.product || null,
          p_project_id: filters.project || null,
          p_account_id: filters.account || null,
          p_compare_start_date: comparisonRange?.start || null,
          p_compare_end_date: comparisonRange?.end || null,
        }) as Promise<RpcResult>);
        if (cancelled) return;
        if (result.error) { setError(result.error.message || "تعذر تحميل مؤشرات الأداء."); setData(null); }
        else setData(result.data as Dashboard);
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : "تعذر تحميل مؤشرات الأداء."); setData(null); }
      } finally {
        if (!cancelled) { setRunning(false); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [org, dateRange.start, dateRange.end, comparisonRange?.start, comparisonRange?.end, filters.branch, filters.department, filters.costCenter, filters.region, filters.product, filters.project, filters.account]);

  const healthLabel = data?.health === "healthy" ? "أداء مستقر" : data?.health === "loss" ? "خسارة في الفترة" : data?.health === "declining" ? "الإيرادات متراجعة" : data?.health === "no_revenue" ? "لا توجد إيرادات" : "بيانات غير كافية";
  const healthTone = data?.health === "loss" || data?.health === "declining" ? "border-rose-200 bg-rose-50 text-rose-700" : data?.health === "healthy" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700";
  const formatMetric = (value: number) => formatMoneyMinor(value);
  const formatDelta = (value: number | null) => value == null ? "—" : formatPercent(value);

  const goToSearchResult = (item: SearchItem) => { setQuery(""); router.push(item.href); };

  return <main dir="rtl" className="min-h-screen bg-[#f4f6f9] text-slate-900">
    <div className="mx-auto max-w-[1560px] px-3 py-4 sm:px-5 lg:px-7 lg:py-5">
      <header className="border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <Link href="/workspace" className="flex items-center gap-2 text-sm font-black text-[#173b73]">
            <span className="flex h-8 w-8 items-center justify-center bg-[#173b73] text-white"><Icon name="chart" size={16} /></span>
            <span>القائد <span className="font-normal text-slate-400">FP&A</span></span>
          </Link>
          <div className="hidden h-6 w-px bg-slate-200 sm:block" />
          <div className="relative min-w-[230px] flex-1 max-w-xl">
            <div className="flex h-9 items-center border border-slate-300 bg-white px-3 focus-within:border-[#173b73]">
              <Icon name="search" size={15} />
              <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && searchResults[0]) goToSearchResult(searchResults[0]); }} placeholder="ابحث في مساحة العمل..." aria-label="البحث في مساحة العمل" className="min-w-0 flex-1 bg-transparent px-2 text-xs font-semibold outline-none placeholder:text-slate-400" />
            </div>
            {searchResults.length > 0 && <div className="erp-panel absolute right-0 top-10 z-50 w-full overflow-hidden p-1">
              {searchResults.map(item => <button type="button" key={item.href} onClick={() => goToSearchResult(item)} className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-right last:border-0 hover:bg-slate-50"><span className="flex h-7 w-7 shrink-0 items-center justify-center bg-slate-100 text-slate-500"><Icon name="arrow" size={13} /></span><span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-800">{item.title}</span><span className="block truncate text-[11px] text-slate-400">{item.subtitle}</span></span></button>)}
            </div>}
          </div>
          <div className="mr-auto flex items-center gap-2">
            <button type="button" aria-label="التنبيهات" className="relative flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-500"><Icon name="bell" size={16} />{data?.alerts?.length ? <span className="absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white">{data.alerts.length}</span> : null}</button>
            <div className="hidden items-center gap-2 border-r border-slate-200 pr-3 sm:flex"><span className="flex h-8 w-8 items-center justify-center bg-[#173b73] text-xs font-black text-white">خ</span><div><p className="text-xs font-bold text-slate-800">المستخدم</p><p className="text-[11px] text-slate-400">إدارة مالية</p></div></div>
          </div>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="mb-1 flex items-center gap-2"><span className="h-2 w-2 bg-cyan-500" /><span className="text-[11px] font-extrabold tracking-[0.16em] text-slate-400">EXECUTIVE / PERFORMANCE</span></div><h1 className="text-[25px] font-black tracking-tight text-[#102d59]">لوحة الإدارة التنفيذية</h1><p className="mt-1 text-xs leading-6 text-slate-500">ملخص مالي تنفيذي مبني على البيانات الفعلية المنشورة والفترة المحددة</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <ReportDateFilter value={dateRange} onChange={setDateRange} />
            <ComparisonMenu value={compare} onChange={setCompare} />
          </div>
        </div>
      </header>

      {loading ? <div className="mt-4 border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">جارٍ تحميل لوحة الإدارة…</div> : <>
        <section className="mt-3 border border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center"><div className="shrink-0 text-xs font-black text-slate-600">فلاتر التقرير</div><div className="min-w-0 flex-1"><ReportDimensionFilters filters={filters} setFilters={setFilters} dateRange={{ start: dateRange.start, end: dateRange.end }} /></div><span className="shrink-0 text-[11px] font-semibold text-slate-400">{running ? "جارٍ التحديث…" : "محدث تلقائيًا"}</span></div>
        </section>

        {error && <div role="alert" className="mt-3 border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}
        {data && <>
          <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="الإيرادات" en="Revenue" value={formatMetric(data.kpis.revenue)} delta={formatDelta(data.kpis.revenue_growth_pct)} icon="trend" />
            <KpiCard label="مجمل الربح" en="Gross Profit" value={formatMetric(data.kpis.gross_profit)} delta={formatPercent(data.kpis.gross_margin_pct ?? 0)} icon="wallet" />
            <KpiCard label="EBITDA" en="Operating Performance" value={formatMetric(data.kpis.ebitda)} delta={formatPercent(data.kpis.ebitda_margin_pct ?? 0)} icon="chart" />
            <KpiCard label="صافي الربح" en="Net Income" value={formatMetric(data.kpis.net_income)} delta={formatPercent(data.kpis.net_margin_pct ?? 0)} icon="profit" />
          </section>

          <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <article className="border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><p className="text-[11px] font-black tracking-[0.12em] text-slate-400">FINANCIAL PERFORMANCE</p><h2 className="mt-1 text-sm font-black text-[#102d59]">أداء الفترة</h2></div><span className={`border px-3 py-1.5 text-xs font-bold ${healthTone}`}>{healthLabel}</span></div>
                <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="نمو الإيرادات" value={formatDelta(data.kpis.revenue_growth_pct)} sub={compare ? "مقارنة بالفترة السابقة" : "المقارنة غير مفعلة"} />
                  <Metric label="هامش مجمل الربح" value={formatDelta(data.kpis.gross_margin_pct)} sub="Gross Margin" />
                  <Metric label="هامش EBITDA" value={formatDelta(data.kpis.ebitda_margin_pct)} sub="EBITDA Margin" />
                  <Metric label="هامش صافي الربح" value={formatDelta(data.kpis.net_margin_pct)} sub="Net Margin" />
                </div>
              </article>

              <article className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3"><p className="text-[11px] font-black tracking-[0.12em] text-slate-400">MANAGEMENT VIEW</p><h2 className="mt-1 text-sm font-black text-[#102d59]">قراءة الإدارة</h2></div>
                <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
                  <ManagementItem label="الإيرادات" value={formatMetric(data.kpis.revenue)} note={compare ? `النمو ${formatDelta(data.kpis.revenue_growth_pct)}` : "الفترة الحالية"} />
                  <ManagementItem label="مجمل الربح" value={formatMetric(data.kpis.gross_profit)} note={`الهامش ${formatDelta(data.kpis.gross_margin_pct)}`} />
                  <ManagementItem label="صافي الربح" value={formatMetric(data.kpis.net_income)} note={`الهامش ${formatDelta(data.kpis.net_margin_pct)}`} />
                </div>
              </article>
            </div>

            <aside className="space-y-3">
              <article className="border border-[#173b73] bg-[#173b73] p-4 text-white">
                <p className="text-[11px] font-bold tracking-[0.12em] text-slate-300">FINANCIAL HEALTH</p><h2 className="mt-2 text-lg font-black">{healthLabel}</h2><p className="mt-2 text-xs leading-6 text-slate-300">التقييم يعتمد على الإيرادات وصافي الربح واتجاه الإيرادات مقارنة بالفترة المرجعية عند تفعيل المقارنة.</p>
                <Link href="/workspace/financial-analysis" className="mt-4 flex h-9 items-center justify-center border border-white/30 bg-white/10 text-xs font-bold hover:bg-white/15">فتح التحليل المالي <span className="mr-2">←</span></Link>
              </article>
              <article className="border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><p className="text-[11px] font-black tracking-[0.12em] text-slate-400">ALERT CENTER</p><h2 className="mt-1 text-sm font-black text-[#102d59]">التنبيهات</h2></div><span className="text-xs font-bold text-slate-400">{data.alerts.length}</span></div>
                <div className="p-2">{data.alerts.length ? data.alerts.map(alert => <div key={alert.code} className="flex items-start gap-3 border-b border-slate-100 p-3 last:border-0"><span className="mt-0.5 text-rose-600"><Icon name="alert" size={16} /></span><div><p className="text-xs font-bold text-slate-800">{alert.title}</p>{alert.value != null && <p className="mt-1 text-[11px] text-slate-500">{formatDelta(Number(alert.value))}</p>}</div></div>) : <p className="p-4 text-xs font-semibold text-slate-400">لا توجد تنبيهات للفترة المحددة.</p>}</div>
              </article>
            </aside>
          </section>

          <section className="mt-3 border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-black tracking-[0.12em] text-slate-400">QUICK ACTIONS</p><h2 className="mt-1 text-sm font-black text-[#102d59]">الانتقال إلى التحليل</h2></div><div className="flex flex-wrap gap-2"><QuickLink href="/workspace/financial-statements" text="القوائم المالية" /><QuickLink href="/workspace/variance" text="الفروقات" /><QuickLink href="/workspace/forecast" text="التوقعات" /><QuickLink href="/workspace/cash" text="التدفق النقدي" /></div></div>
          </section>
        </>}
      </>}
    </div>
  </main>;
}

function KpiCard({ label, en, value, delta, icon }: { label: string; en: string; value: string; delta: string; icon: "trend" | "wallet" | "chart" | "profit" }) {
  return <article className="border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.03)]"><div className="flex items-start justify-between"><div><p className="text-xs font-black text-slate-800">{label}</p><p className="mt-0.5 text-[11px] font-semibold text-slate-400">{en}</p></div><span className="flex h-8 w-8 items-center justify-center border border-slate-200 bg-slate-50 text-[#173b73]"><Icon name={icon} size={15} /></span></div><p className="mt-5 text-xl font-black tracking-tight text-[#102d59]">{value}</p><div className="mt-2 border-t border-slate-100 pt-2 text-xs font-bold text-slate-500">{delta}</div></article>;
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="border-b border-slate-100 p-4 last:border-0 lg:border-b-0 lg:border-l last:lg:border-l-0"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-3 text-lg font-black text-[#102d59]">{value}</p><p className="mt-1 text-[11px] font-semibold text-slate-400">{sub}</p></div>;
}

function ManagementItem({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-3 text-base font-black text-slate-900">{value}</p><p className="mt-1 text-[11px] font-semibold text-slate-400">{note}</p></div>;
}

function QuickLink({ href, text }: { href: string; text: string }) {
  return <Link href={href} className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:border-[#173b73] hover:text-[#173b73]">{text}<Icon name="arrow" size={13} /></Link>;
}
