"use client";

import { useMemo, useState } from "react";

export type ReportDateMode = "month" | "year" | "range";
export type ReportDateRange = { mode: ReportDateMode; start: string; end: string };

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (v: string) => { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); };
const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const normalize = (mode: ReportDateMode, start: string, end: string): ReportDateRange => ({ mode, start, end });

export function getDefaultReportDateRange(mode: ReportDateMode = "year"): ReportDateRange {
  const now = new Date();
  if (mode === "month") return { mode, start: toIso(new Date(now.getFullYear(), now.getMonth(), 1)), end: toIso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  if (mode === "range") return { mode, start: toIso(new Date(now.getFullYear(), 0, 1)), end: toIso(now) };
  return { mode, start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
}

export function ReportDateFilter({ value, onChange }: { value: ReportDateRange; onChange: (value: ReportDateRange) => void }) {
  const [open, setOpen] = useState(false);
  const anchor = useMemo(() => value.start ? fromIso(value.start) : new Date(), [value.start]);
  const monthIndex = anchor.getMonth();
  const year = anchor.getFullYear();

  const setMonth = (nextYear: number, nextMonth: number) => {
    const start = new Date(nextYear, nextMonth, 1);
    const end = new Date(nextYear, nextMonth + 1, 0);
    onChange(normalize("month", toIso(start), toIso(end)));
  };
  const shiftMonth = (delta: number) => setMonth(year + Math.floor((monthIndex + delta) / 12), (monthIndex + delta + 12) % 12);
  const setYear = (nextYear: number) => onChange(normalize("year", `${nextYear}-01-01`, `${nextYear}-12-31`));
  const currentYear = new Date().getFullYear();
  const display = value.mode === "month" ? `${monthNames[monthIndex]} ${year}` : value.mode === "year" ? `السنة ${year}` : `${value.start || "—"} → ${value.end || "—"}`;

  return <div className="relative">
    <button type="button" onClick={() => setOpen(v => !v)} className="inline-flex min-h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-bold">
      الفترة: {display}⌄
    </button>
    {open && <div className="absolute right-0 top-10 z-50 w-[min(94vw,430px)] border border-slate-300 bg-white p-3 shadow-xl">
      <div className="mb-3 grid grid-cols-3 border border-slate-200 bg-slate-50 p-1">
        {([['month','شهر'],['year','سنة'],['range','من تاريخ إلى تاريخ']] as const).map(([mode,label]) => <button key={mode} type="button" onClick={() => { const next = mode === "month" ? getDefaultReportDateRange("month") : mode === "year" ? getDefaultReportDateRange("year") : { mode: "range" as const, start: value.start || `${currentYear}-01-01`, end: value.end || toIso(new Date()) }; onChange(next); }} className={`px-2 py-2 text-[11px] font-bold ${value.mode === mode ? "bg-slate-950 text-white" : "text-slate-500"}`}>{label}</button>)}
      </div>

      {value.mode === "month" && <div className="flex items-center justify-between border border-slate-200 px-2 py-2">
        <button type="button" aria-label="الشهر السابق" onClick={() => shiftMonth(-1)} className="h-8 w-8 border border-slate-200 text-lg">‹</button>
        <span className="text-sm font-bold">{monthNames[monthIndex]} {year}</span>
        <button type="button" aria-label="الشهر التالي" onClick={() => shiftMonth(1)} className="h-8 w-8 border border-slate-200 text-lg">›</button>
      </div>}

      {value.mode === "year" && <label className="block text-[11px] font-bold text-slate-500">السنة
        <input type="number" min={2001} max={9999} step={1} value={year} onChange={e => { const next = Math.max(2001, Math.min(9999, Number(e.target.value) || 2001)); setYear(next); }} className="mt-1 min-h-10 w-full border border-slate-300 bg-white px-3 text-sm font-bold" />
        <span className="mt-1 block text-[10px] font-normal text-slate-400">من 2001 وحتى 9999</span>
      </label>}

      {value.mode === "range" && <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[11px] font-bold text-slate-500">من تاريخ<input type="date" value={value.start} onChange={e => onChange(normalize("range", e.target.value, value.end))} className="mt-1 min-h-10 w-full border border-slate-300 bg-white px-2 text-xs" /></label>
        <label className="text-[11px] font-bold text-slate-500">إلى تاريخ<input type="date" value={value.end} min={value.start || undefined} onChange={e => onChange(normalize("range", value.start, e.target.value))} className="mt-1 min-h-10 w-full border border-slate-300 bg-white px-2 text-xs" /></label>
      </div>}

      {value.mode === "range" && value.start && value.end && value.start > value.end && <p className="mt-2 text-[11px] font-bold text-red-600">تاريخ البداية يجب أن يكون قبل أو مساويًا لتاريخ النهاية.</p>}
      <button type="button" onClick={() => setOpen(false)} className="mt-3 min-h-9 w-full bg-slate-950 px-3 text-xs font-bold text-white">تم</button>
    </div>}
  </div>;
}
