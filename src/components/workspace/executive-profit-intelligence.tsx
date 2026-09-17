"use client";

import { useMemo } from "react";
import { formatMoneyMinor, formatPercent } from "@/lib/format";

type BridgeValue = { current: number; comparison: number; delta: number };
type Bridge = Record<string, BridgeValue>;
type Driver = { id: string; code: string; name: string; classification: string; current: number; comparison: number; delta: number };

const money = (v: number) => formatMoneyMinor(Number(v || 0));
const pct = (v: number) => formatPercent(Number(v || 0));
const value = (bridge: Bridge | null | undefined, key: string) => Number(bridge?.[key]?.current || 0);
const delta = (bridge: Bridge | null | undefined, key: string) => Number(bridge?.[key]?.delta || 0);

function margin(bridge: Bridge | null | undefined, profitKey: string) {
  const revenue = value(bridge, "revenue");
  return revenue ? (value(bridge, profitKey) / revenue) * 100 : null;
}

export function ExecutiveProfitIntelligence({ bridge, comparison }: { bridge?: Bridge | null; drivers?: Driver[]; comparison: boolean }) {
  const insights = useMemo(() => {
    const out: Array<{ title: string; text: string; tone: "positive" | "negative" | "neutral" }> = [];
    if (!bridge) return out;

    const revenue = value(bridge, "revenue");
    const revenueDelta = delta(bridge, "revenue");
    const grossDelta = delta(bridge, "gross_profit");
    const cogsDelta = delta(bridge, "cogs");
    const opexDelta = delta(bridge, "operating_expenses");
    const ebitdaDelta = delta(bridge, "ebitda");
    const netDelta = delta(bridge, "net_income");
    const grossMargin = margin(bridge, "gross_profit");
    const ebitdaMargin = margin(bridge, "ebitda");
    const revenueGrowth = revenue && comparison ? (revenueDelta / Math.abs(Number(bridge.revenue.comparison || 0) || revenue)) * 100 : null;

    if (!comparison) {
      if (revenue) out.push({ title: "مستوى الربحية", text: `مجمل الربح ${money(value(bridge, "gross_profit"))} بهامش ${grossMargin == null ? "—" : pct(grossMargin)}، وEBITDA ${money(value(bridge, "ebitda"))} بهامش ${ebitdaMargin == null ? "—" : pct(ebitdaMargin)}.`, tone: value(bridge, "ebitda") >= 0 ? "positive" : "negative" });
      if (value(bridge, "net_income") < 0) out.push({ title: "نقطة الانتباه", text: `صافي الربح سلبي بقيمة ${money(value(bridge, "net_income"))}. الأولوية التحليلية هي تحديد ما إذا كان الضغط من الهامش أو التكاليف أو بنود ما بعد EBITDA.`, tone: "negative" });
      return out.slice(0, 3);
    }

    if (revenueDelta !== 0) out.push({ title: revenueDelta > 0 ? "نمو الإيرادات" : "تراجع الإيرادات", text: `الإيرادات ${revenueDelta > 0 ? "زادت" : "انخفضت"} ${money(Math.abs(revenueDelta))}${revenueGrowth == null ? "" : ` (${pct(Math.abs(revenueGrowth))})`} مقارنة بالفترة السابقة.`, tone: revenueDelta > 0 ? "positive" : "negative" });

    const grossMarginPrevious = Number(bridge.gross_profit?.comparison || 0) && Number(bridge.revenue?.comparison || 0) ? (Number(bridge.gross_profit.comparison) / Number(bridge.revenue.comparison)) * 100 : null;
    if (grossMargin != null && grossMarginPrevious != null && Math.abs(grossMargin - grossMarginPrevious) >= 1) {
      const change = grossMargin - grossMarginPrevious;
      out.push({ title: change < 0 ? "ضغط على هامش الربح" : "تحسن هامش الربح", text: `الهامش الإجمالي ${change > 0 ? "ارتفع" : "انخفض"} ${pct(Math.abs(change))} نقطة مئوية، مع تغير تكلفة المبيعات قدره ${money(Math.abs(cogsDelta))}.`, tone: change > 0 ? "positive" : "negative" });
    } else if (cogsDelta !== 0 && revenueDelta !== 0) {
      const cogsGrowth = Number(bridge.cogs?.comparison || 0) ? cogsDelta / Math.abs(Number(bridge.cogs.comparison)) : 0;
      const revenueGrowthRate = Number(bridge.revenue?.comparison || 0) ? revenueDelta / Math.abs(Number(bridge.revenue.comparison)) : 0;
      if (cogsGrowth > revenueGrowthRate + 0.05) out.push({ title: "تكلفة المبيعات أسرع من الإيرادات", text: `تكلفة المبيعات تنمو بوتيرة أعلى من الإيرادات، ما يخلق ضغطًا على الهامش الإجمالي.`, tone: "negative" });
    }

    if (opexDelta !== 0 && revenueDelta !== 0) {
      const opexGrowth = Number(bridge.operating_expenses?.comparison || 0) ? opexDelta / Math.abs(Number(bridge.operating_expenses.comparison)) : 0;
      const revenueGrowthRate = Number(bridge.revenue?.comparison || 0) ? revenueDelta / Math.abs(Number(bridge.revenue.comparison)) : 0;
      if (opexGrowth > revenueGrowthRate + 0.05) out.push({ title: "ضغط تشغيلي", text: `المصروفات التشغيلية تنمو أسرع من الإيرادات، ما يضغط على الربحية التشغيلية.`, tone: "negative" });
    }

    if (ebitdaDelta !== 0 && netDelta !== 0 && Math.sign(ebitdaDelta) !== Math.sign(netDelta)) out.push({ title: "فجوة بين الربح التشغيلي والنتيجة النهائية", text: `التغير في EBITDA (${money(ebitdaDelta)}) يتحرك في اتجاه مختلف عن صافي الربح (${money(netDelta)}). راجع الإهلاك والتمويل والضرائب والبنود غير التشغيلية.`, tone: "negative" });
    if (value(bridge, "net_income") < 0) out.push({ title: "النتيجة النهائية تحت الصفر", text: `صافي الربح الحالي ${money(value(bridge, "net_income"))}. المطلوب هو تحديد مصدر الضغط المالي قبل اتخاذ إجراء تشغيلي.`, tone: "negative" });
    if (grossDelta !== 0 && Math.abs(grossDelta) < Math.abs(revenueDelta) * 0.5 && revenueDelta > 0) out.push({ title: "النمو لا يتحول بالكامل إلى ربح", text: `الإيرادات تنمو، لكن الزيادة في مجمل الربح أقل بكثير من حركة الإيرادات، ما يستحق فحص جودة النمو والهامش.`, tone: "negative" });

    return out.slice(0, 5);
  }, [bridge, comparison]);

  if (!bridge) return null;

  const revenue = value(bridge, "revenue");
  const gross = value(bridge, "gross_profit");
  const ebitda = value(bridge, "ebitda");
  const net = value(bridge, "net_income");
  const grossMargin = margin(bridge, "gross_profit");
  const ebitdaMargin = margin(bridge, "ebitda");

  return <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
    <article className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-[11px] font-black tracking-[0.12em] text-slate-400">EXECUTIVE INTELLIGENCE</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-sm font-black text-[#102d59]">ماذا تغير في الأداء المالي؟</h2><p className="mt-1 text-[11px] text-slate-400">ملخص إداري مبني على الأثر المالي، وليس على أسماء الحسابات.</p></div><span className="text-[10px] font-bold text-slate-400">{comparison ? "مقارنة بالفترة السابقة" : "الفترة الحالية"}</span></div>
      </div>
      <div className="grid gap-0 border-b border-slate-100 sm:grid-cols-4">
        {[["الإيرادات", revenue, null], ["مجمل الربح", gross, grossMargin], ["EBITDA", ebitda, ebitdaMargin], ["صافي الربح", net, null]].map(([label, v, m]) => <div key={String(label)} className="border-b border-slate-100 px-4 py-4 last:border-0 sm:border-b-0 sm:border-l sm:last:border-l-0"><p className="text-[10px] font-black text-slate-500">{label}</p><p className="mt-2 truncate text-base font-black text-[#102d59]">{money(Number(v))}</p>{m != null && <p className="mt-1 text-[10px] font-bold text-slate-400">الهامش {pct(Number(m))}</p>}</div>)}
      </div>
      <div className="divide-y divide-slate-100">{insights.length ? insights.map((item, index) => <div key={`${item.title}-${index}`} className="flex gap-3 px-4 py-4"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.tone === "negative" ? "bg-rose-500" : item.tone === "positive" ? "bg-emerald-500" : "bg-slate-300"}`} /><div><p className="text-xs font-black text-slate-800">{item.title}</p><p className="mt-1 text-xs leading-6 text-slate-500">{item.text}</p></div></div>) : <p className="p-5 text-xs text-slate-400">لا توجد حركة مالية كافية لاستخراج إشارة إدارية.</p>}</div>
    </article>

    <article className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3"><p className="text-[11px] font-black tracking-[0.12em] text-slate-400">MANAGEMENT FOCUS</p><h2 className="mt-1 text-sm font-black text-[#102d59]">ما الذي يستحق الانتباه؟</h2><p className="mt-1 text-[11px] text-slate-400">مؤشرات قرار مختصرة بدل تفاصيل دفتر الأستاذ.</p></div>
      <div className="space-y-3 p-4">
        <div className="border border-slate-100 p-3"><p className="text-[10px] font-black text-slate-500">جودة النمو</p><p className="mt-1 text-xs font-bold text-slate-700">{comparison ? (delta(bridge, "revenue") > 0 && delta(bridge, "gross_profit") <= 0 ? "الإيرادات تنمو دون تحسن موازٍ في مجمل الربح" : "مسار الإيرادات يحتاج قراءة مع الهامش" ) : "فعّل المقارنة لقياس جودة النمو عبر الزمن"}</p></div>
        <div className="border border-slate-100 p-3"><p className="text-[10px] font-black text-slate-500">الربحية التشغيلية</p><p className="mt-1 text-xs font-bold text-slate-700">هامش EBITDA: {ebitdaMargin == null ? "—" : pct(ebitdaMargin)}</p></div>
        <div className="border border-slate-100 p-3"><p className="text-[10px] font-black text-slate-500">النتيجة النهائية</p><p className={`mt-1 text-xs font-bold ${net < 0 ? "text-rose-600" : "text-slate-700"}`}>{net < 0 ? `صافي خسارة ${money(Math.abs(net))}` : `صافي ربح ${money(net)}`}</p></div>
      </div>
    </article>
  </section>;
}
