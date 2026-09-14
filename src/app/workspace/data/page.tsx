"use client";

import Link from "next/link";

const actions = [
  {
    href: "/workspace/data/accounts",
    title: "دليل الحسابات",
    description: "إدارة شجرة الحسابات وتصنيفها وربطها بالبيانات المالية.",
  },
  {
    href: "/workspace/data/import",
    title: "رفع ملف Excel",
    description: "استيراد القيود والحركات الفعلية من CSV أو XLSX ثم التحقق والمطابقة قبل النشر.",
    primary: true,
  },
  {
    href: "/workspace/data/manual",
    title: "إدخال يدوي",
    description: "إدخال القيود اليومية مباشرة عندما تحتاج إلى تسجيل البيانات دون رفع ملف.",
  },
  {
    href: "/workspace/data-monitoring/connectors",
    title: "Integration / ربط الأنظمة",
    description: "ربط الأنظمة والمصادر الخارجية المتاحة وإدارة مصادر البيانات المتصلة.",
  },
];

export default function DataCenterPage() {
  return (
    <main dir="rtl" className="min-h-full text-slate-900">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold text-slate-500">مركز البيانات</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">البيانات</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          كل ما تحتاجه لإدخال البيانات المالية إلى المنصة: دليل الحسابات، الرفع من Excel، الإدخال اليدوي، وربط الأنظمة.
        </p>
      </div>

      <section className="mt-6" aria-labelledby="data-actions">
        <div className="mb-4">
          <h2 id="data-actions" className="text-base font-bold text-slate-950">إدارة البيانات</h2>
          <p className="mt-1 text-sm text-slate-500">اختر طريقة إدخال أو إدارة بيانات شركتك.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`group border bg-white p-5 transition-colors hover:border-slate-400 ${action.primary ? "border-slate-900" : "border-slate-200"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-slate-950 group-hover:text-slate-700">{action.title}</h3>
                {action.primary && <span className="bg-slate-950 px-2 py-1 text-[10px] font-bold text-white">المسار الرئيسي</span>}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">{action.description}</p>
              <span className="mt-4 inline-block text-xs font-semibold text-slate-700">فتح ←</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
