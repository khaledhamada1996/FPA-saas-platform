"use client";

import Link from "next/link";

const sections = [
  { label: "الإيرادات", value: "—" },
  { label: "تكلفة المبيعات", value: "—" },
  { label: "مجمل الربح", value: "—" },
  { label: "المصروفات التشغيلية", value: "—" },
  { label: "EBITDA", value: "—" },
  { label: "صافي الربح", value: "—" },
];

export default function ActualsPage() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/workspace" className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-950 sm:text-sm">العودة لمساحة العمل</Link>
          <div className="min-w-0 text-right"><p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 sm:text-xs">ACTUALS</p><h1 className="mt-1 truncate text-base font-bold text-slate-950 sm:text-lg">البيانات الفعلية</h1></div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
        <div className="border-b border-slate-200 pb-7 sm:pb-8">
          <p className="text-xs font-bold text-slate-400 sm:text-sm">المرحلة الثالثة</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">النموذج المالي الفعلي</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500 sm:text-base sm:leading-8">هذه الشاشة تقرأ فقط البيانات التي تم التحقق منها واعتماد مطابقتها ثم نشرها إلى النموذج المالي. لا يتم عرض أرقام افتراضية على أنها بيانات فعلية.</p>
        </div>

        <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0"><h3 className="font-bold text-amber-950">لا توجد بيانات فعلية منشورة بعد</h3><p className="mt-2 text-sm leading-7 text-amber-900/75">يجب أولًا إكمال الاستيراد والتحقق والمطابقة واعتمادها. بعدها فقط يتم إنشاء Financial Facts وحساب القوائم والمؤشرات.</p></div>
            <Link href="/workspace/data/accounts" className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-bold text-white hover:bg-slate-800 sm:w-auto">مراجعة المطابقة</Link>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <article key={section.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-sm text-slate-500">{section.label}</p><p className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">{section.value}</p><p className="mt-2 text-xs text-slate-400">بانتظار نشر البيانات الفعلية</p></article>
          ))}
        </div>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-6"><h3 className="font-bold text-slate-950">سجل النشر</h3><p className="mt-1 text-xs leading-6 text-slate-500 sm:text-sm">سيظهر هنا رقم دفعة الاستيراد وعدد الصفوف ووقت النشر بعد أول عملية نشر ناجحة.</p></div>
          <div className="p-8 text-center text-sm text-slate-400 sm:p-10">لا توجد عمليات نشر بعد</div>
        </section>
      </section>
    </main>
  );
}
