"use client";

import { useMemo } from "react";
import { formatMoneyMinor } from "@/lib/format";

type BridgeValue = { current: number; comparison: number; delta: number };
type Bridge = Record<string, BridgeValue>;
type Driver = { id: string; code: string; name: string; classification: string; current: number; comparison: number; delta: number };

const labels: Record<string,string> = {
  revenue: "الإيرادات", cogs: "تكلفة المبيعات", gross_profit: "مجمل الربح", operating_expenses: "المصروفات التشغيلية",
  ebitda: "EBITDA", depreciation_amortization: "الإهلاك والاستهلاك", finance_cost: "تكاليف التمويل", other_expenses: "مصروفات أخرى", tax: "الضريبة", net_income: "صافي الربح"
};
const classificationLabels: Record<string,string> = {
  revenue: "إيراد", cogs: "تكلفة مبيعات", operating_expense: "مصروف تشغيلي", depreciation_amortization: "إهلاك", finance_cost: "تمويل", other_expense: "مصروف آخر", tax: "ضريبة", other_income: "دخل آخر"
};

export function ExecutiveProfitIntelligence({ bridge, drivers, comparison }: { bridge?: Bridge | null; drivers?: Driver[]; comparison: boolean }) {
  const rows = ["revenue","cogs","gross_profit","operating_expenses","ebitda","depreciation_amortization","finance_cost","other_expenses","tax","net_income"];
  const available = rows.filter(k => bridge?.[k]);
  const topDrivers = useMemo(() => (drivers || []).slice().sort((a,b) => Math.abs(Number(b.delta)) - Math.abs(Number(a.delta))).slice(0,8), [drivers]);
  if (!available.length && !topDrivers.length) return null;
  const money = (v:number) => formatMoneyMinor(Number(v || 0));
  return <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
    <article className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3"><p className="text-[11px] font-black tracking-[0.12em] text-slate-400">PROFIT BRIDGE</p><h2 className="mt-1 text-sm font-black text-[#102d59]">جسر الربحية ومصدر التغير</h2><p className="mt-1 text-[11px] text-slate-400">يوضح أين تحركت النتيجة من الإيرادات حتى صافي الربح {comparison ? "مقارنة بالفترة السابقة" : "داخل الفترة الحالية"}</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-xs"><thead><tr className="border-b border-slate-100 bg-slate-50 text-right text-[10px] text-slate-500"><th className="px-4 py-2.5">البند</th><th className="px-4 py-2.5">الحالي</th><th className="px-4 py-2.5">السابق</th><th className="px-4 py-2.5">التغير</th><th className="px-4 py-2.5">أثره على الربح</th></tr></thead><tbody>{available.map(k => { const v=bridge![k]; const delta=Number(v.delta); const profitImpact = ["cogs","operating_expenses","depreciation_amortization","finance_cost","other_expenses","tax"].includes(k) ? -delta : delta; const cls=profitImpact>0?"text-emerald-600":profitImpact<0?"text-rose-600":"text-slate-500"; return <tr key={k} className={`border-b border-slate-100 ${k === "gross_profit" || k === "ebitda" || k === "net_income" ? "font-black bg-slate-50/60" : ""}`}><td className="px-4 py-2.5 text-slate-800">{labels[k]}</td><td className="px-4 py-2.5 font-semibold">{money(v.current)}</td><td className="px-4 py-2.5 text-slate-500">{comparison ? money(v.comparison) : "—"}</td><td className={`px-4 py-2.5 font-black ${delta>0?"text-emerald-600":delta<0?"text-rose-600":"text-slate-500"}`}>{comparison ? `${delta>0?"+":""}${money(delta)}` : "—"}</td><td className={`px-4 py-2.5 font-bold ${comparison ? cls : "text-slate-400"}`}>{comparison ? `${profitImpact>0?"+":""}${money(profitImpact)}` : "—"}</td></tr>})}</tbody></table></div>
    </article>
    <article className="border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><p className="text-[11px] font-black tracking-[0.12em] text-slate-400">ACCOUNT DRIVERS</p><h2 className="mt-1 text-sm font-black text-[#102d59]">الحسابات المحركة للنتيجة</h2><p className="mt-1 text-[11px] text-slate-400">الأكثر تأثيرًا على تغير صافي الربح بين الفترتين</p></div>{topDrivers.length ? <div className="divide-y divide-slate-100">{topDrivers.map(d => { const positive=Number(d.delta)>0; return <div key={d.id} className="px-4 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{d.code} — {d.name}</p><p className="mt-1 text-[10px] text-slate-400">{classificationLabels[d.classification] || d.classification}</p></div><span className={`shrink-0 text-xs font-black ${positive?"text-emerald-600":"text-rose-600"}`}>{positive?"+":""}{money(d.delta)}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-400"><span>الحالي: {money(d.current)}</span><span>السابق: {comparison ? money(d.comparison) : "—"}</span></div></div>})}</div> : <p className="p-5 text-xs text-slate-400">فعّل المقارنة لعرض الحسابات التي صنعت التغير.</p>}</article>
  </section>;
}
