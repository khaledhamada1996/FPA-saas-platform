"use client";

import Link from "next/link";

const actions = [
  {
    href: "/workspace/data/manual",
    title: "إدخال يدوي",
    description: "أدخل القيود اليومية مباشرة عندما تكون البيانات محدودة أو تحتاج إلى تسجيل سريع.",
  },
  {
    href: "/workspace/data/history",
    title: "سجل البيانات",
    description: "راجع عمليات الاستيراد وحالاتها وانتقل إلى تفاصيل كل عملية للمراجعة والمتابعة.",
  },
  {
    href: "/workspace/data/accounts",
    title: "دليل الحسابات",
    description: "إدارة دليل الحسابات من مساره المتخصص دون خلطه مع مركز إدخال البيانات.",
  },
  {
    href: "/workspace/data/master-data",
    title: "البيانات المرجعية",
    description: "إدارة البيانات المرجعية المستخدمة في التحليل والتصنيف والأبعاد.",
  },
  {
    href: "/workspace/data/lineage",
    title: "تتبع مصدر البيانات",
    description: "تتبع مصدر البيانات ومسارها داخل المنصة عند توفر سجل التتبع.",
  },
  {
    href: "/workspace/data-monitoring/connectors",
    title: "ربط الأنظمة والمصادر",
    description: "إدارة مصادر البيانات والموصلات المتاحة للأنظمة الخارجية.",
  },
];

export default function DataCenterPage() {
  return (
    <main dir="rtl" className="min-h-full text-slate-900">
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">مركز البيانات</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">إدخال وإدارة البيانات</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              نقطة البداية لكل ما يتعلق بالبيانات الفعلية: إدخالها، استيرادها، مراجعتها، تتبعها، وإدارتها قبل استخدامها في التحليل والتخطيط.
            </p>
          </div>
          <Link
            href="/workspace/data/manual"
            className="inline-flex min-h-11 items-center justify-center bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            إدخال قيد يدوي
          </Link>
        </div>
      </div>

      <section className="mt-6" aria-labelledby="data-actions">
        <div className="mb-3">
          <h2 id="data-actions" className="text-base font-bold text-slate-950">ماذا تريد أن تفعل؟</h2>
          <p className="mt-1 text-sm text-slate-500">اختر المسار المناسب بدل البحث عن الوظيفة بين صفحات متعددة.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group border border-slate-200 bg-white p-5 transition-colors hover:border-slate-400"
            >
              <h3 className="font-bold text-slate-950 group-hover:text-slate-700">{action.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{action.description}</p>
              <span className="mt-4 inline-block text-xs font-semibold text-slate-700">فتح المسار ←</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6 border border-slate-200 bg-white p-5" aria-labelledby="import-flow">
        <h2 id="import-flow" className="text-base font-bold text-slate-950">دورة البيانات</h2>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            "اختيار نوع البيانات",
            "رفع الملف أو الإدخال",
            "التحقق والمراجعة والربط",
            "الاستيراد والمطابقة والنشر",
          ].map((step, index) => (
            <div key={step} className="border border-slate-200 p-3">
              <span className="text-xs font-bold text-slate-400">{String(index + 1).padStart(2, "0")}</span>
              <p className="mt-1 font-semibold text-slate-800">{step}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
