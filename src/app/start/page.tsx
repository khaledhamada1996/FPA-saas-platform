"use client";

import { useState } from "react";

const sources = [
  { id: "excel", title: "Excel", description: "رفع بياناتك من ملف Excel منظم" },
  { id: "manual", title: "إدخال يدوي", description: "ابدأ بإدخال البيانات مباشرة" },
  { id: "integration", title: "ربط نظام", description: "سنجهز الربط مع نظامك لاحقًا" },
];

export default function StartPage() {
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("excel");
  const [started, setStarted] = useState(false);

  function handleStart() {
    if (!company.trim()) return;
    setStarted(true);
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 lg:px-10">
          <a href="/" className="text-sm font-semibold text-slate-500 hover:text-slate-900">العودة للصفحة الرئيسية</a>
          <div className="text-right">
            <div className="font-bold text-slate-950">FP&A</div>
            <div className="text-xs text-slate-400">بدء بيئة العمل</div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16 lg:px-10 lg:py-24">
        {!started ? (
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-bold tracking-[0.14em] text-slate-400">START YOUR WORKSPACE</p>
              <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">لنبدأ من بياناتك الفعلية</h1>
              <p className="mt-5 leading-8 text-slate-500">سنبدأ بإعداد بيئة العمل ثم ننتقل إلى إدخال البيانات والتحقق منها وبناء النموذج المالي قبل أي تحليل أو مؤشرات.</p>
              <div className="mt-8 space-y-4 text-sm text-slate-600">
                <p>✓ لا نخلط بين البيانات الفعلية والموازنة والتوقعات</p>
                <p>✓ لا نعتمد رقمًا ماليًا قبل التحقق من مصدره</p>
                <p>✓ الحسابات المالية الأساسية تُنفذ بطريقة حتمية داخل النظام</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/40 sm:p-9">
              <label htmlFor="company" className="block text-sm font-bold text-slate-900">اسم المنشأة</label>
              <input
                id="company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="مثال: شركة القائد"
                className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 outline-none transition focus:border-slate-500 focus:bg-white"
              />

              <div className="mt-8">
                <p className="text-sm font-bold text-slate-900">كيف ستبدأ بإضافة البيانات؟</p>
                <div className="mt-4 grid gap-3">
                  {sources.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSource(item.id)}
                      className={`flex items-center justify-between rounded-xl border p-4 text-right transition ${source === item.id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                    >
                      <div>
                        <p className="font-bold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                      </div>
                      <span className={`h-4 w-4 rounded-full border ${source === item.id ? "border-slate-900 bg-slate-900" : "border-slate-300"}`} />
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleStart}
                disabled={!company.trim()}
                className="mt-8 w-full rounded-xl bg-slate-950 px-6 py-4 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                إنشاء بيئة العمل والبدء
              </button>
              <p className="mt-4 text-center text-xs text-slate-400">تسجيل الدخول والمصادقة سيتم تفعيلهما في المرحلة النهائية</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/40 sm:p-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-xl text-white">✓</div>
            <p className="mt-7 text-sm font-bold tracking-[0.14em] text-slate-400">WORKSPACE READY</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">بيئة العمل جاهزة للخطوة التالية</h1>
            <p className="mx-auto mt-4 max-w-xl leading-8 text-slate-500">تم تجهيز البداية لمنشأة <strong className="text-slate-900">{company}</strong>. المصدر المختار: <strong className="text-slate-900">{sources.find((item) => item.id === source)?.title}</strong>.</p>
            <div className="mt-9 grid gap-3 text-right sm:grid-cols-3">
              {['إعداد الهيكل المالي', 'إضافة الحسابات', 'إدخال البيانات والتحقق'].map((step, index) => (
                <div key={step} className="rounded-2xl bg-slate-50 p-5">
                  <span className="text-xs font-bold text-slate-400">0{index + 1}</span>
                  <p className="mt-5 text-sm font-bold text-slate-900">{step}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-slate-500">المرحلة التالية ستكون بناء مساحة العمل الفعلية بدلًا من شاشة الدخول فقط.</p>
          </div>
        )}
      </section>
    </main>
  );
}
