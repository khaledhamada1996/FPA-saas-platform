"use client";

import Link from "next/link";

const highlights = [
  { value: "Actuals", label: "بيانات فعلية موثوقة", tone: "bg-cyan-50 text-cyan-700 border-cyan-100" },
  { value: "Budget", label: "خطة مالية واضحة", tone: "bg-amber-50 text-amber-700 border-amber-100" },
  { value: "Forecast", label: "رؤية لما هو قادم", tone: "bg-violet-50 text-violet-700 border-violet-100" },
  { value: "Decision", label: "قرار مبني على أرقام", tone: "bg-emerald-50 text-emerald-700 border-emerald-100" },
];

const workflow = [
  ["01", "اجمع", "استورد البيانات الفعلية من ملفاتك ومصادرك"],
  ["02", "نظّم", "وحّد الحسابات والأبعاد قبل التحليل"],
  ["03", "خطّط", "ابنِ الميزانية والتوقعات والسيناريوهات"],
  ["04", "حلّل", "افهم الفروقات والسيولة والأداء"],
  ["05", "قرّر", "حوّل الأرقام إلى قرار إداري واضح"],
];

function TrendChart() {
  const bars = [42, 54, 48, 62, 58, 71, 67, 79, 74, 88, 83, 94];
  return (
    <div className="relative h-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:h-52 sm:p-5">
      <div className="absolute inset-x-5 top-14 border-t border-dashed border-slate-200" />
      <div className="absolute inset-x-5 top-24 border-t border-dashed border-slate-100" />
      <div className="absolute inset-x-5 top-34 border-t border-dashed border-slate-100" />
      <div className="relative z-10 flex items-center justify-between">
        <div><p className="text-[10px] font-bold tracking-[0.16em] text-slate-400">PERFORMANCE</p><p className="mt-1 text-sm font-black text-slate-950">اتجاه الأداء المالي</p></div>
        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">+12.4%</span>
      </div>
      <div className="absolute inset-x-5 bottom-7 top-16 flex items-end gap-1.5 sm:gap-2">
        {bars.map((height, index) => <div key={index} className="flex h-full flex-1 items-end"><div className={`w-full rounded-t-md transition ${index > 8 ? "bg-slate-900" : "bg-slate-200"}`} style={{ height: `${height}%` }} /></div>)}
      </div>
    </div>
  );
}

function DecisionCard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] font-bold tracking-[0.16em] text-slate-500">MANAGEMENT VIEW</p><h3 className="mt-2 text-lg font-black">ماذا تغيّر؟ ولماذا؟</h3></div>
        <span className="rounded-lg border border-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-400">2026</span>
      </div>
      <div className="mt-7 space-y-4">
        {[['الإيرادات', '+8.7%', 'أعلى من الخطة'], ['المصروفات', '+3.1%', 'تحت المتابعة'], ['النقد المتاح', '2.71M', 'وضع مستقر']].map(([name, value, note], index) => (
          <div key={name} className="flex items-center justify-between border-b border-slate-800 pb-4 last:border-0 last:pb-0">
            <div><p className="text-xs font-bold text-slate-200">{name}</p><p className="mt-1 text-[10px] text-slate-500">{note}</p></div>
            <span className={`text-sm font-black ${index === 1 ? "text-amber-300" : "text-white"}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main dir="rtl" className="min-h-screen overflow-hidden bg-[#f8fafc] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="FP&A الرئيسية">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">F</span>
            <span><strong className="block text-base font-black tracking-tight text-slate-950">FP&A</strong><small className="block text-[9px] font-bold tracking-[0.16em] text-slate-400">FINANCIAL PLANNING & ANALYSIS</small></span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4"><Link href="/login" className="hidden px-3 py-2 text-sm font-bold text-slate-600 hover:text-slate-950 sm:block">تسجيل الدخول</Link><Link href="/signup" className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 sm:px-5 sm:text-sm">ابدأ الآن</Link></div>
        </div>
      </header>

      <section className="relative border-b border-slate-200 bg-white">
        <div className="absolute left-0 top-0 h-40 w-40 rounded-full bg-cyan-100/60 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-violet-100/60 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20 lg:px-8 lg:py-24">
          <div className="order-2 lg:order-1">
            <div className="mb-6 flex flex-wrap gap-2">{highlights.map((item) => <span key={item.value} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${item.tone}`}><span className="font-black">{item.value}</span><span className="mx-1 text-slate-300">·</span>{item.label}</span>)}</div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.12] tracking-[-0.035em] text-slate-950 sm:text-5xl lg:text-6xl xl:text-[70px]">من البيانات المالية<br /><span className="text-slate-400">إلى قرار يمكن قياسه</span></h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg sm:leading-9">منصة FP&A تجمع البيانات الفعلية والتخطيط والتوقع والتحليل في مساحة عمل واحدة تساعد فرق المالية والإدارة على رؤية الصورة كاملة.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link href="/signup" className="inline-flex h-13 items-center justify-center rounded-xl bg-slate-950 px-8 py-4 text-sm font-bold text-white shadow-xl shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800">إنشاء مساحة العمل</Link><Link href="/login" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-7 py-4 text-sm font-bold text-slate-600 transition hover:border-slate-400 hover:text-slate-950">لدي حساب بالفعل</Link></div>
            <p className="mt-5 text-[11px] font-semibold text-slate-400">ابدأ بتنظيم بياناتك ثم وسّع مساحة العمل مع احتياجاتك</p>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative mx-auto max-w-2xl">
              <div className="mb-3 flex items-center justify-between px-1"><span className="text-[10px] font-bold tracking-[0.16em] text-slate-400">YOUR FINANCE WORKSPACE</span><span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600"><i className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> بيانات متصلة</span></div>
              <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3"><TrendChart /><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4"><p className="text-[10px] font-bold text-cyan-700">ACTUALS</p><p className="mt-2 text-2xl font-black text-slate-950">8.42M</p><p className="mt-1 text-[10px] font-semibold text-slate-500">+12.4% عن الفترة السابقة</p></div><div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><p className="text-[10px] font-bold text-amber-700">BUDGET</p><p className="mt-2 text-2xl font-black text-slate-950">8.90M</p><p className="mt-1 text-[10px] font-semibold text-slate-500">94.6% من الخطة</p></div></div></div>
                <DecisionCard />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f8fafc]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl"><span className="text-[10px] font-black tracking-[0.18em] text-slate-400">ONE CONNECTED WORKFLOW</span><h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">لا تبدأ من التقرير ابدأ من البيانات الصحيحة</h2><p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">صممنا التجربة بحيث تتحرك البيانات معك من المصدر إلى التحليل ثم إلى القرار بدون تشتيت بين أدوات منفصلة.</p></div>
          <div className="mt-10 grid overflow-hidden rounded-3xl border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-5">{workflow.map(([number, title, text], index) => <div key={number} className={`relative p-5 sm:p-6 ${index < workflow.length - 1 ? "border-b border-slate-200 lg:border-b-0 lg:border-l" : ""}`}><span className="text-[10px] font-black text-slate-300">{number}</span><h3 className="mt-8 text-base font-black text-slate-950">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{text}</p></div>)}</div>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:px-8 lg:py-24">
          <div><span className="text-[10px] font-black tracking-[0.18em] text-slate-500">BUILT FOR MANAGEMENT QUESTIONS</span><h2 className="mt-4 max-w-xl text-3xl font-black leading-tight sm:text-4xl">ليس المهم كم رقمًا لديك المهم أن تعرف ماذا تعني</h2><p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">راقب الأداء، افهم الفروقات، اختبر السيناريوهات، وتابع النقد والتوقعات من منظور إداري واضح.</p></div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-slate-800 bg-slate-800 sm:grid-cols-4">{[["كيف نؤدي؟","Performance"],["ماذا تغيّر؟","Variance"],["إلى أين نتجه؟","Forecast"],["ماذا لو؟","Scenarios"]].map(([q, en]) => <div key={en} className="bg-slate-950 p-5 sm:p-6"><span className="text-[9px] font-bold tracking-wider text-slate-600">{en}</span><p className="mt-8 text-sm font-bold text-slate-200">{q}</p></div>)}</div>
        </div>
      </section>

      <section className="bg-white"><div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24"><span className="text-[10px] font-black tracking-[0.18em] text-slate-400">READY WHEN YOU ARE</span><h2 className="mx-auto mt-4 max-w-2xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">ابدأ من البيانات وابنِ قرارك المالي خطوة بخطوة</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500">مساحة عمل واحدة للبيانات والتخطيط والتوقع والتحليل والتقارير.</p><Link href="/signup" className="mt-8 inline-flex rounded-xl bg-slate-950 px-8 py-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-800">ابدأ مساحة العمل</Link></div></section>

      <footer className="border-t border-slate-200 bg-[#f8fafc] px-4 py-8 text-center"><p className="text-[10px] font-black tracking-[0.18em] text-slate-400">FP&A PLATFORM · FINANCIAL PLANNING & ANALYSIS</p><p className="mt-2 text-[10px] font-semibold text-slate-400">منصة لإدارة التخطيط والتحليل المالي</p></footer>
    </main>
  );
}
