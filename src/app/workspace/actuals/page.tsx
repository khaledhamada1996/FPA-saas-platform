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
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/workspace" className="text-sm font-semibold text-slate-500 hover:text-slate-950">العودة لمساحة العمل</Link>
          <div className="text-right">
            <p className="text-xs font-bold tracking-[0.14em] text-slate-400">ACTUALS</p>
            <h1 className="mt-1 font-bold text-slate-950">البيانات الفعلية</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-6 py-10 lg:px-10">
        <div className="border-b border-slate-200 pb-8">
          <p className="text-sm font-bold text-slate-400">المرحلة الثالثة</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">النموذج المالي الفعلي</h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-500">
            هذه الشاشة تقرأ فقط البيانات التي تم التحقق منها واعتماد مطابقتها ثم نشرها إلى النموذج المالي. لا يتم عرض أرقام افتراضية على أنها بيانات فعلية.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-bold text-amber-950">لا توجد بيانات فعلية منشورة بعد</h3>
              <p className="mt-2 text-sm leading-7 text-amber-900/75">
                يجب أولًا إكمال الاستيراد والتحقق والمطابقة واعتمادها. بعدها فقط يتم إنشاء Financial Facts وحساب القوائم والمؤشرات.
              </p>
            </div>
            <Link href="/workspace/data/accounts" className="rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-bold text-white hover:bg-slate-800">مراجعة المطابقة</Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <article key={section.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">{section.label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-950">{section.value}</p>
              <p className="mt-2 text-xs text-slate-400">بانتظار نشر البيانات الفعلية</p>
            </article>
          ))}
        </div>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <h3 className="font-bold text-slate-950">سجل النشر</h3>
            <p className="mt-1 text-sm text-slate-500">سيظهر هنا رقم دفعة الاستيراد وعدد الصفوف ووقت النشر بعد أول عملية نشر ناجحة.</p>
          </div>
          <div className="p-8 text-center text-sm text-slate-400">لا توجد عمليات نشر بعد</div>
        </section>
      </section>
    </main>
  );
}
