"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Period = { id: string; period_start: string; period_end: string; status: string };

const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

export default function AIAnalystPage() {
  const [org, setOrg] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [period, setPeriod] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const id = sessionStorage.getItem("activeOrganizationId") || "";
    setOrg(id);
    if (!id) {
      setError("لم يتم تحديد مساحة العمل.");
      setLoading(false);
      return;
    }
    void getSupabaseBrowserClient()
      .from("financial_periods")
      .select("id,period_start,period_end,status")
      .eq("organization_id", id)
      .order("period_start", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (queryError) setError(queryError.message);
        const list = (data ?? []) as Period[];
        setPeriods(list);
        if (list[0]) setPeriod(list[0].id);
        setLoading(false);
      });
  }, []);

  async function ask() {
    const cleanQuestion = question.trim();
    if (!org || !period || !cleanQuestion || running) return;
    setRunning(true);
    setError("");
    setAnswer("");
    const { data: sessionData, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      setError("انتهت جلسة الدخول. أعد تسجيل الدخول ثم حاول مرة أخرى.");
      setRunning(false);
      return;
    }
    try {
      const response = await fetch("/api/ai-analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ organizationId: org, periodId: period, question: cleanQuestion }),
      });
      const payload = await response.json() as { answer?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر الحصول على التحليل.");
      setAnswer(payload.answer || "لم تصل إجابة.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الحصول على التحليل.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-[#172033]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/workspace" className="text-sm font-semibold text-slate-500">العودة لمساحة العمل</Link>
          <div className="text-right"><p className="text-[10px] font-bold tracking-[.14em] text-slate-400">AI FINANCIAL ANALYST</p><h1 className="font-bold text-slate-950">المحلل المالي الذكي</h1></div>
        </div>
      </header>
      <section className="mx-auto max-w-[1100px] px-4 py-7 sm:px-6 lg:py-10">
        <div className="border-b border-slate-200 pb-7">
          <p className="text-xs font-bold tracking-[.14em] text-slate-400">EXPLANATION LAYER</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">اسأل عن أداء شركتك</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">يقرأ المحلل النتائج الصادرة من محركات القوائم والتحليل المالي ولوحة الإدارة، ثم يشرحها لك. الذكاء الاصطناعي لا يحسب الأرقام ولا يغيّر البيانات.</p>
        </div>
        {loading ? <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">جاري تحميل الفترات المالية...</div> : <>
          <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <label className="block text-sm font-bold">الفترة المالية</label>
            <select value={period} onChange={(e) => { setPeriod(e.target.value); setAnswer(""); }} className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm">
              {periods.map((item) => <option key={item.id} value={item.id}>{formatDate(item.period_start)} — {formatDate(item.period_end)}</option>)}
            </select>
            {!periods.length && <p className="mt-3 text-sm text-slate-500">لا توجد فترة مالية منشأة لهذه الشركة بعد.</p>}
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <label htmlFor="ai-question" className="text-sm font-bold">سؤالك</label>
            <textarea id="ai-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000} rows={5} placeholder="مثال: ما أهم المؤشرات التي تستحق انتباهي في هذه الفترة؟" className="mt-3 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-sm leading-7 outline-none focus:border-slate-500" />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-slate-400">{question.length}/2000</span><button type="button" disabled={!period || !question.trim() || running} onClick={ask} className="min-h-11 rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{running ? "جاري التحليل..." : "تحليل السؤال"}</button></div>
          </div>
          {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-7 text-red-700">{error}</div>}
          {answer && <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4"><h3 className="font-bold text-slate-950">التحليل</h3><span className="text-xs font-semibold text-slate-400">المصدر: محركات مالية حتمية</span></div><div className="mt-5 whitespace-pre-wrap text-sm leading-8 text-slate-700">{answer}</div><p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-400">هذا التحليل تفسيري وليس مصدرًا مستقلًا للأرقام. اعتمد دائمًا على القوائم والمؤشرات المالية المعروضة داخل المنصة عند اتخاذ القرار.</p></section>}
        </>}
      </section>
    </main>
  );
}
