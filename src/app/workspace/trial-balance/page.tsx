"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Period = { id: string; period_start: string; period_end: string; status: string };
type TrialRow = { code: string; name: string; account_type: string | null; statement_type: string | null; statement_section: string | null; opening_debit: number; opening_credit: number; period_debit: number; period_credit: number; closing_debit: number; closing_credit: number };
type TrialBalance = { period_start: string; period_end: string; period_status: string; row_count: number; total_period_debit: number; total_period_credit: number; period_difference: number; rows: TrialRow[] };

function moneyMinor(value: number) { return (Number(value || 0) / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function dateLabel(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }); }

export default function TrialBalancePage() {
  const [orgId, setOrgId] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [data, setData] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId") || "";
    setOrgId(id);
    if (!id) { setLoading(false); setError("لم يتم تحديد مساحة عمل."); return; }
    const supabase = getSupabaseBrowserClient();
    void supabase.from("financial_periods").select("id,period_start,period_end,status").eq("organization_id", id).order("period_start", { ascending: false }).then(({ data: rows, error: queryError }) => {
      if (queryError) setError(queryError.message);
      const next = (rows || []) as Period[];
      setPeriods(next);
      if (next[0]) setPeriodId(next[0].id);
      setLoading(false);
    });
  }, []);

  const selected = useMemo(() => periods.find((period) => period.id === periodId), [periods, periodId]);

  async function loadTrialBalance() {
    if (!orgId || !periodId) return;
    setRunning(true); setError("");
    const supabase = getSupabaseBrowserClient();
    const { data: result, error: rpcError } = await supabase.rpc("get_trial_balance", { p_organization_id: orgId, p_period_id: periodId });
    if (rpcError) { setError(rpcError.message); setData(null); } else setData(result as TrialBalance);
    setRunning(false);
  }

  return <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"><a href="/workspace" className="text-xs font-semibold text-slate-500 hover:text-slate-950 sm:text-sm">العودة لمساحة العمل</a><div className="text-right"><p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 sm:text-xs">FINANCIAL MODEL</p><h1 className="mt-1 text-base font-bold text-slate-950 sm:text-lg">ميزان المراجعة</h1></div></div></header>
    <section className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <div className="border-b border-slate-200 pb-7"><p className="text-xs font-bold text-slate-400 sm:text-sm">محرك Trial Balance</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">ميزان المراجعة الفعلي</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500 sm:text-base">يُحتسب مباشرة من الحقائق المالية الفعلية المنشورة فقط، مع مراعاة نطاق صلاحيات المستخدم والأبعاد المسموح له برؤيتها.</p></div>
      {loading ? <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500">جاري تحميل الفترات المالية...</div> : <>
        <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><label className="text-sm font-bold text-slate-900">الفترة المالية</label><select value={periodId} onChange={(event) => { setPeriodId(event.target.value); setData(null); }} className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-600">{periods.length === 0 ? <option value="">لا توجد فترات مالية بعد</option> : periods.map((period) => <option key={period.id} value={period.id}>{dateLabel(period.period_start)} — {dateLabel(period.period_end)} · {period.status}</option>)}</select></div><button disabled={!periodId || running} onClick={loadTrialBalance} className="min-h-11 rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{running ? "جاري الحساب..." : "عرض ميزان المراجعة"}</button></div>
        {selected && <div className="mt-4 text-xs text-slate-500">الفترة المحددة: {dateLabel(selected.period_start)} إلى {dateLabel(selected.period_end)}</div>}
        {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">{error}</div>}
        {periods.length === 0 && !error && <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold leading-7 text-amber-800">لا توجد فترة مالية حتى الآن. سيتم إنشاء الفترة تلقائيًا عند نشر أول استيراد صالح.</div>}
        {data && <>
          <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold text-slate-400">إجمالي المدين</p><p className="mt-2 text-xl font-bold text-slate-950">{moneyMinor(data.total_period_debit)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold text-slate-400">إجمالي الدائن</p><p className="mt-2 text-xl font-bold text-slate-950">{moneyMinor(data.total_period_credit)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold text-slate-400">الفرق</p><p className={`mt-2 text-xl font-bold ${data.period_difference === 0 ? "text-emerald-700" : "text-red-700"}`}>{moneyMinor(data.period_difference)}</p></div></div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-right text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">كود الحساب</th><th className="px-4 py-3">الحساب</th><th className="px-4 py-3">مدين الفترة</th><th className="px-4 py-3">دائن الفترة</th><th className="px-4 py-3">رصيد افتتاحي مدين</th><th className="px-4 py-3">رصيد افتتاحي دائن</th><th className="px-4 py-3">رصيد ختامي مدين</th><th className="px-4 py-3">رصيد ختامي دائن</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.code} className="border-b border-slate-100 last:border-0"><td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{row.code}</td><td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td><td className="px-4 py-3 tabular-nums">{moneyMinor(row.period_debit)}</td><td className="px-4 py-3 tabular-nums">{moneyMinor(row.period_credit)}</td><td className="px-4 py-3 tabular-nums">{moneyMinor(row.opening_debit)}</td><td className="px-4 py-3 tabular-nums">{moneyMinor(row.opening_credit)}</td><td className="px-4 py-3 tabular-nums">{moneyMinor(row.closing_debit)}</td><td className="px-4 py-3 tabular-nums">{moneyMinor(row.closing_credit)}</td></tr>)}</tbody></table></div><div className="border-t border-slate-200 px-4 py-4 text-xs font-semibold text-slate-500">عدد الحسابات ذات الحركة أو الرصيد: {data.row_count}</div></div>
        </>}
      </>}
    </section>
  </main>;
}
