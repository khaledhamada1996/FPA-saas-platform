"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatMoneyMinor, formatPercent, formatDate } from "@/lib/format";
import {
  ReportDimensionFilters,
  emptyReportDimensionFilters,
  ReportDimensionFilterState,
} from "@/components/workspace/report-dimension-filters";

type Period = { id: string; period_start: string; period_end: string; status: string };
type Analysis = {
  current: { revenue: number; gross_profit: number; ebitda: number; net_income: number };
  prior: { revenue: number; gross_profit: number; ebitda: number; net_income: number } | null;
  prior_period: { start: string; end: string } | null;
  metrics: {
    revenue_growth_pct: number | null;
    gross_margin_pct: number | null;
    ebitda_margin_pct: number | null;
    net_margin_pct: number | null;
    operating_expense_ratio_pct: number | null;
    revenue_trend: string;
  };
};

const supabase = getSupabaseBrowserClient();

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 tabular-nums">{value}</p>
      <p className="mt-2 text-[10px] text-slate-500">{hint}</p>
    </article>
  );
}

export default function FinancialAnalysisPage() {
  const [org, setOrg] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [period, setPeriod] = useState("");
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filters, setFilters] = useState<ReportDimensionFilterState>(emptyReportDimensionFilters);

  useEffect(() => {
    const id = sessionStorage.getItem("activeOrganizationId") || localStorage.getItem("activeOrganizationId") || "";
    setOrg(id);
    if (!id) {
      setError("لم يتم تحديد مساحة عمل.");
      setLoading(false);
      return;
    }

    void supabase
      .from("financial_periods")
      .select("id,period_start,period_end,status")
      .eq("organization_id", id)
      .order("period_start", { ascending: false })
      .then(({ data: rows, error: periodError }) => {
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

    const run = async () => {
      const { data: result, error: rpcError } = await supabase.rpc("get_financial_analysis_filtered", {
        p_organization_id: org,
        p_period_id: period,
        p_branch_id: filters.branch || null,
        p_department_id: filters.department || null,
        p_cost_center_id: filters.costCenter || null,
        p_region_id: filters.region || null,
        p_product_id: filters.product || null,
        p_project_id: filters.project || null,
        p_account_id: filters.account || null,
      });

      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message);
        setData(null);
      } else {
        setData(result as Analysis);
      }
      setRunning(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [org, period, filters.branch, filters.department, filters.costCenter, filters.region, filters.product, filters.project, filters.account]);

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="/workspace" className="inline-flex min-h-10 items-center border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
            ← مساحة العمل
          </a>
          <div className="text-right">
            <p className="text-[10px] font-black tracking-[0.16em] text-slate-400">FINANCIAL ANALYSIS</p>
            <h1 className="mt-1 text-lg font-black tracking-tight text-slate-950">التحليل المالي</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        <div className="border-b border-slate-200 pb-7">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600">
                <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-amber-500" : "bg-emerald-500"}`} />
                {running ? "جاري تحديث المؤشرات" : "بيانات فعلية منشورة"}
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">مؤشرات الأداء المالي</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">تحليل حتمي مبني على البيانات الفعلية المنشورة، مع مقارنة بالفترة السابقة عند توفرها. الذكاء الاصطناعي ليس جزءًا من الحسابات.</p>
            </div>
            <div className="min-w-[230px]">
              <label className="text-[11px] font-bold text-slate-500">الفترة المالية
                <select value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-2 min-h-11 w-full border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-slate-950">
                  {periods.map((item) => <option key={item.id} value={item.id}>{formatDate(item.period_start)} — {formatDate(item.period_end)}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-7 border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">جاري تحميل الفترات المالية...</div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-2 border border-slate-200 bg-white p-3 shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
              <ReportDimensionFilters options={{ branches: [], departments: [], cost_centers: [], regions: [], products: [], projects: [], accounts: [] }} filters={filters} setFilters={setFilters} dateRange={selectedPeriod ? { start: selectedPeriod.period_start, end: selectedPeriod.period_end } : undefined} />
              <span className="text-[10px] text-slate-400">تتحدث النتائج تلقائيًا عند تغيير الفترة أو الأبعاد</span>
            </div>

            {error && <div className="mt-5 border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

            {data && (
              <>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <MetricCard label="نمو الإيرادات" value={formatPercent(data.metrics.revenue_growth_pct)} hint="مقارنة بالفترة السابقة" />
                  <MetricCard label="هامش مجمل الربح" value={formatPercent(data.metrics.gross_margin_pct)} hint="مجمل الربح ÷ الإيرادات" />
                  <MetricCard label="هامش EBITDA" value={formatPercent(data.metrics.ebitda_margin_pct)} hint="الربحية التشغيلية قبل الإهلاك" />
                  <MetricCard label="هامش صافي الربح" value={formatPercent(data.metrics.net_margin_pct)} hint="صافي الربح ÷ الإيرادات" />
                  <MetricCard label="المصروفات التشغيلية" value={formatPercent(data.metrics.operating_expense_ratio_pct)} hint="نسبة من الإيرادات" />
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                  <section className="border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                      <div><p className="text-[10px] font-black tracking-[0.14em] text-slate-400">CURRENT PERIOD</p><h3 className="mt-1 text-lg font-black text-slate-950">الأداء المالي</h3></div>
                      <span className="border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">{data.metrics.revenue_trend === "up" ? "الإيرادات صاعدة" : data.metrics.revenue_trend === "down" ? "الإيرادات متراجعة" : data.metrics.revenue_trend === "flat" ? "الإيرادات مستقرة" : "لا توجد مقارنة"}</span>
                    </div>
                    <div className="grid sm:grid-cols-2">
                      {[["الإيرادات", data.current.revenue], ["مجمل الربح", data.current.gross_profit], ["EBITDA", data.current.ebitda], ["صافي الربح", data.current.net_income]].map(([label, value]) => (
                        <div key={String(label)} className="border-b border-slate-100 px-5 py-5 last:border-0 sm:px-6 sm:odd:border-l">
                          <p className="text-xs font-bold text-slate-500">{label}</p>
                          <p className="mt-2 text-xl font-black text-slate-950 tabular-nums">{formatMoneyMinor(Number(value))}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                    <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><p className="text-[10px] font-black tracking-[0.14em] text-slate-400">PERIOD COMPARISON</p><h3 className="mt-1 text-lg font-black text-slate-950">مقارنة بالفترة السابقة</h3></div>
                    {data.prior ? (
                      <div className="overflow-x-auto p-5 sm:p-6">
                        <div className="grid min-w-[420px] grid-cols-[1fr_1fr_1fr] border-b border-slate-200 pb-3 text-[10px] font-bold text-slate-400"><span>المؤشر</span><span>الحالي</span><span>السابق</span></div>
                        {[["الإيرادات", data.current.revenue, data.prior.revenue], ["مجمل الربح", data.current.gross_profit, data.prior.gross_profit], ["EBITDA", data.current.ebitda, data.prior.ebitda], ["صافي الربح", data.current.net_income, data.prior.net_income]].map(([label, current, previous]) => (
                          <div key={String(label)} className="grid min-w-[420px] grid-cols-[1fr_1fr_1fr] border-b border-slate-100 py-3.5 text-sm last:border-0"><span className="font-bold text-slate-700">{label}</span><span className="font-black tabular-nums">{formatMoneyMinor(Number(current))}</span><span className="text-slate-500 tabular-nums">{formatMoneyMinor(Number(previous))}</span></div>
                        ))}
                      </div>
                    ) : <p className="p-6 text-sm leading-7 text-slate-500">لا توجد فترة مالية سابقة متاحة للمقارنة.</p>}
                  </section>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
