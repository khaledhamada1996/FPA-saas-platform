"use client";

import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4 py-10 sm:px-6">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
          <p className="text-xs font-bold tracking-[0.16em] text-slate-400">FP&A ACCESS CONTROL</p>
          <h1 className="mt-4 text-2xl font-bold text-slate-950 sm:text-3xl">لا تملك صلاحية الوصول إلى هذه الشاشة</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-slate-500 sm:text-base">
            الوصول في هذه المنصة يتم تحديده لكل مستخدم على مستوى الشاشة والإجراء. اطلب من المسؤول المباشر منحك الصلاحية المطلوبة.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/workspace" className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-bold text-white hover:bg-slate-800">
              العودة إلى مساحة العمل
            </Link>
            <Link href="/start" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              شركاتي
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
