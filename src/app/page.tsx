"use client";

import { useEffect, useState } from "react";

const capabilities = [
  { title: "Actuals", value: "8.42M", note: "+12.4%", icon: "↗" },
  { title: "Budget", value: "8.90M", note: "94.6% utilized", icon: "▥" },
  { title: "Forecast", value: "9.18M", note: "Q4 outlook", icon: "⌁" },
  { title: "Variance", value: "−480K", note: "3.8% below plan", icon: "Δ" },
];

const flow = ["Actuals", "Model", "Budget", "Forecast", "Variance", "Scenarios", "Reports", "Decision"];

function MiniChart({ bars = [42, 56, 48, 65, 58, 76, 69, 86, 79, 94] }: { bars?: number[] }) {
  return (
    <div className="flex h-28 items-end gap-1.5 sm:h-36 sm:gap-2" aria-hidden="true">
      {bars.map((height, index) => (
        <div key={index} className="group relative flex h-full flex-1 items-end">
          <div className="w-full rounded-t-sm bg-slate-300 transition-all duration-700 ease-out group-hover:bg-slate-700" style={{ height: `${height}%` }} />
        </div>
      ))}
    </div>
  );
}

function ForecastVisual() {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-7">
      <div className="absolute inset-x-0 top-0 h-px bg-slate-900" />
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] font-bold tracking-[0.18em] text-slate-400">FORECAST</p><h3 className="mt-2 text-lg font-bold text-slate-950">التوقع المالي</h3></div>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-bold text-slate-500">2026</span>
      </div>
      <div className="mt-7 grid grid-cols-3 gap-2">
        {["الإيرادات", "EBITDA", "النقد"].map((label, i) => <div key={label} className="border-r border-slate-100 pr-3 first:border-0"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-1 text-sm font-bold">{["9.18M", "2.04M", "2.71M"][i]}</p></div>)}
      </div>
      <div className="mt-7 rounded-2xl bg-slate-50 p-4"><MiniChart bars={[35, 44, 52, 49, 61, 68, 63, 77, 86, 92]} /><div className="mt-3 flex justify-between text-[9px] text-slate-400"><span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span></div></div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-[10px] font-medium text-slate-400">Forecast vs Budget</span><span className="text-xs font-bold text-slate-700">+280K</span></div>
    </div>
  );
}

function BudgetVisual() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:p-7">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">BUDGET</p><h3 className="mt-2 text-lg font-bold">الميزانية مقابل الفعلي</h3></div><span className="text-2xl font-light text-slate-400">01</span></div>
      <div className="mt-8 space-y-5">
        {[['التشغيل', 78, '1.82M / 2.34M'], ['المبيعات', 91, '4.20M / 4.62M'], ['الإدارة', 63, '0.76M / 1.20M']].map(([label, percent, amount]) => <div key={String(label)}><div className="mb-2 flex justify-between text-xs"><span className="text-slate-300">{label}</span><span className="font-bold">{percent}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-white transition-all duration-1000" style={{ width: `${percent}%` }} /></div><p className="mt-1.5 text-[9px] text-slate-500">{amount}</p></div>)}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 border-t border-slate-800 pt-5"><div><p className="text-[10px] text-slate-500">Total Budget</p><p className="mt-1 font-bold">8.90M SAR</p></div><div><p className="text-[10px] text-slate-500">Remaining</p><p className="mt-1 font-bold">0.48M SAR</p></div></div>
    </div>
  );
}

export default function HomePage() {
  const [active, setActive] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setActive((v) => (v + 1) % 4), 2600); return () => window.clearInterval(timer); }, []);

  return (
    <main dir="rtl" className="min-h-screen overflow-hidden bg-[#f7f8fa] text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div><p className="text-xl font-black tracking-tight text-slate-950">FP&A</p><p className="text-[10px] font-bold tracking-[0.16em] text-slate-400">FINANCIAL PLANNING & ANALYSIS</p></div>
          <a href="/login" className="text-sm font-bold text-slate-600 transition hover:text-slate-950">دخول مساحة العمل</a>
        </div>
      </header>

      <section className="relative border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-20 lg:px-8 lg:py-28">
          <div className="order-2 lg:order-1">
            <p className="mb-5 inline-flex border border-slate-200 px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-slate-500">FP&A FOR MODERN FINANCE TEAMS</p>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.14] tracking-[-0.03em] text-slate-950 sm:text-5xl lg:text-6xl xl:text-[68px]">من البيانات المالية<br /><span className="text-slate-400">إلى قرار يمكن قياسه</span></h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg sm:leading-9">نظم بياناتك الفعلية، ابنِ الميزانية، حدّث التوقعات، حلّل الفروقات واختبر السيناريوهات قبل اتخاذ القرار.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"><a href="/signup" className="inline-flex h-13 items-center justify-center rounded-xl bg-slate-950 px-8 py-4 text-sm font-bold text-white shadow-xl shadow-slate-900/10 transition duration-300 hover:-translate-y-0.5 hover:bg-slate-800">ابدأ مساحة العمل</a><a href="/login" className="inline-flex items-center justify-center px-5 py-4 text-sm font-bold text-slate-500 transition hover:text-slate-950">لديك حساب؟ دخول</a></div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-semibold text-slate-400"><span>Actuals</span><span>Budget</span><span>Forecast</span><span>Variance</span><span>Scenarios</span><span>Executive Reporting</span></div>
          </div>
          <div className="order-1 lg:order-2">
            <div className="relative mx-auto max-w-2xl">
              <div className="absolute -inset-5 -z-0 rounded-[32px] bg-slate-100 blur-2xl" />
              <div className="relative grid gap-3 sm:grid-cols-2">
                {capabilities.map((item, index) => <div key={item.title} className={`rounded-2xl border p-5 transition-all duration-700 ${active === index ? 'border-slate-900 bg-white shadow-xl -translate-y-1' : 'border-slate-200 bg-white/80'}`}><div className="flex items-center justify-between"><span className="text-[10px] font-bold tracking-widest text-slate-400">{item.title}</span><span className="text-sm text-slate-400">{item.icon}</span></div><p className="mt-5 text-2xl font-black tracking-tight text-slate-950">{item.value}</p><p className="mt-1 text-[10px] font-semibold text-slate-400">{item.note}</p></div>)}
                <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-widest text-slate-400">EXECUTIVE TREND</p><p className="mt-1 text-sm font-bold">الأداء الشهري</p></div><span className="text-[10px] font-bold text-slate-400">SAR · 2026</span></div><div className="mt-5"><MiniChart /></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f8fa]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl"><p className="text-[10px] font-bold tracking-[0.18em] text-slate-400">CORE WORKSPACE</p><h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">أدوات الإدارة المالية في صورة واحدة</h2><p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">واجهة مصممة حول دورة FP&A الفعلية، وليس حول قائمة أدوات منفصلة.</p></div>
          <div className="mt-10 grid gap-5 lg:grid-cols-2"><ForecastVisual /><BudgetVisual /></div>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">THE FINANCE CYCLE</p><h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">دورة مالية مترابطة من الواقع إلى القرار</h2><div className="mt-10 grid grid-cols-2 gap-px overflow-hidden border border-slate-800 bg-slate-800 sm:grid-cols-4 lg:grid-cols-8">{flow.map((step, index) => <div key={step} className="bg-slate-950 p-4 transition hover:bg-slate-900 sm:p-5"><span className="text-[10px] font-bold text-slate-600">0{index + 1}</span><p className="mt-7 text-xs font-bold text-slate-200">{step}</p></div>)}</div></div>
      </section>

      <section className="bg-white"><div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24"><p className="text-[10px] font-bold tracking-[0.18em] text-slate-400">READY FOR BETTER DECISIONS?</p><h2 className="mx-auto mt-4 max-w-2xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">ابدأ ببناء مساحة FP&A لمنشأتك</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500">ابدأ بتنظيم البيانات ثم انتقل تدريجيًا إلى الميزانية والتوقع والتحليل والتقارير التنفيذية.</p><a href="/signup" className="mt-8 inline-flex rounded-xl bg-slate-950 px-8 py-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-800">إنشاء مساحة عمل</a></div></section>

      <footer className="border-t border-slate-200 bg-[#f7f8fa] px-4 py-7 text-center text-[10px] font-semibold tracking-widest text-slate-400">FP&A PLATFORM · FINANCIAL PLANNING & ANALYSIS</footer>
    </main>
  );
}
