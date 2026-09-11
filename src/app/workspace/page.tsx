"use client";

import { useState } from "react";

const modules = [
  { title: "البيانات الفعلية", text: "إضافة واستيراد البيانات بعد التحقق والمطابقة." },
  { title: "الميزانية", text: "بناء خطة مالية شهرية وسنوية قابلة للمقارنة." },
  { title: "التوقعات", text: "تحديث الرؤية المستقبلية اعتمادًا على الأداء الفعلي." },
  { title: "الفروقات", text: "مقارنة الفعلي بالموازنة والتوقع وتحديد أسباب الانحراف." },
  { title: "التدفق النقدي", text: "متابعة السيولة والتدفقات المتوقعة." },
  { title: "السيناريوهات", text: "اختبار أثر القرارات والافتراضات قبل اعتمادها." },
];

export default function WorkspacePage() {
  const [active, setActive] = useState("overview");

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-4 lg:px-8">
          <div><p className="text-xs font-bold tracking-[0.14em] text-slate-400">FP&A WORKSPACE</p><h1 className="mt-1 font-bold text-slate-950">مساحة العمل المالي</h1></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">شركة جديدة</div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[230px_1fr]">
        <aside className="border-l border-slate-200 bg-white p-5 lg:min-h-[calc(100vh-73px)]">
          <nav className="space-y-1">
            {[['overview','نظرة عامة'],['actuals','البيانات الفعلية'],['budget','الميزانية'],['forecast','التوقعات'],['variance','الفروقات'],['cash','التدفق النقدي'],['scenarios','السيناريوهات'],['data','البيانات والاستيراد']].map(([id,label]) => <button key={id} type="button" onClick={() => setActive(id)} className={`w-full rounded-xl px-4 py-3 text-right text-sm font-semibold transition ${active === id ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}
          </nav>
          <div className="mt-10 border-t border-slate-100 pt-6"><p className="text-xs leading-6 text-slate-400">تسجيل الدخول والصلاحيات ستضاف في المرحلة النهائية.</p></div>
        </aside>
        <section className="p-6 lg:p-10">
          {active === 'overview' ? <>
            <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-8 sm:flex-row sm:items-end"><div><p className="text-sm font-bold text-slate-400">OVERVIEW</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">لنبدأ ببناء النموذج المالي</h2><p className="mt-3 max-w-2xl leading-7 text-slate-500">لا توجد بيانات مالية منشورة بعد. ابدأ بإضافة البيانات والتحقق منها قبل ظهور أي مؤشرات.</p></div><a href="/workspace/data" className="rounded-xl bg-slate-950 px-6 py-4 text-center text-sm font-bold text-white hover:bg-slate-800">إضافة البيانات</a></div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{modules.map((module) => <article key={module.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="font-bold text-slate-950">{module.title}</h3><p className="mt-3 text-sm leading-7 text-slate-500">{module.text}</p><span className="mt-6 inline-block text-xs font-bold text-slate-400">لم يتم الإعداد بعد</span></article>)}</div>
          </> : active === 'data' ? <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm lg:p-12"><p className="text-sm font-bold tracking-[0.14em] text-slate-400">DATA IMPORT</p><h2 className="mt-3 text-3xl font-bold text-slate-950">البيانات والاستيراد</h2><p className="mt-4 max-w-2xl leading-8 text-slate-500">رفع Excel أو CSV والتحقق من بنية القيود قبل الانتقال إلى المطابقة.</p><a href="/workspace/data" className="mt-8 inline-flex rounded-xl bg-slate-950 px-6 py-4 text-sm font-bold text-white">فتح مركز الاستيراد</a></div> : <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm lg:p-12"><p className="text-sm font-bold tracking-[0.14em] text-slate-400">{active.toUpperCase()}</p><h2 className="mt-3 text-3xl font-bold text-slate-950">هذه الوحدة قيد البناء</h2><p className="mt-4 max-w-2xl leading-8 text-slate-500">سيتم بناء هذه الوحدة بعد تثبيت البيانات الفعلية والتحقق منها.</p></div>}
        </section>
      </div>
    </main>
  );
}
