"use client";

import { useState } from "react";

const sources = [
  { id: "excel", title: "Excel أو CSV", description: "رفع بياناتك من ملف منظم بعد إعداد المؤسسة" },
  { id: "manual", title: "إدخال يدوي", description: "إضافة البيانات مباشرة من داخل مساحة العمل" },
  { id: "integration", title: "ربط نظام", description: "ربط نظام محاسبي أو تشغيلي في خطوة لاحقة" },
];

type CompanyProfile = {
  name: string;
  country: string;
  industry: string;
  currency: string;
  fiscalYearStart: string;
};

export default function StartPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [company, setCompany] = useState<CompanyProfile>({
    name: "",
    country: "",
    industry: "",
    currency: "SAR",
    fiscalYearStart: "يناير",
  });
  const [source, setSource] = useState("excel");

  const canContinue = Boolean(company.name.trim() && company.country && company.industry && company.currency);

  function updateCompany(field: keyof CompanyProfile, value: string) {
    setCompany((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 lg:px-10">
          <a href="/" className="text-sm font-semibold text-slate-500 hover:text-slate-900">العودة للصفحة الرئيسية</a>
          <div className="text-right"><div className="font-bold text-slate-950">FP&A</div><div className="text-xs text-slate-400">إعداد مساحة العمل</div></div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16 lg:px-10 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-sm font-bold tracking-[0.14em] text-slate-400">START YOUR WORKSPACE</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
              {step === 1 ? "لنبدأ بإعداد مؤسستك" : step === 2 ? "كيف تريد إضافة بياناتك؟" : "مساحة العمل جاهزة"}
            </h1>
            <p className="mt-5 leading-8 text-slate-500">
              {step === 1
                ? "عرّف مؤسستك أولًا حتى نضبط العملة والسنة المالية وسياق التحليل قبل التعامل مع أي بيانات."
                : step === 2
                  ? "يمكنك اختيار المصدر الآن أو تغييره لاحقًا من داخل مساحة العمل. لن يبدأ أي استيراد في هذه الخطوة."
                  : "تم تجهيز مساحة العمل وفق معلومات مؤسستك. يمكنك الآن بناء الهيكل المالي ثم إضافة بياناتك والتحقق منها."}
            </p>
            <div className="mt-8 space-y-4 text-sm text-slate-600">
              <p>✓ معلومات المؤسسة تسبق الاستيراد والتكاملات</p>
              <p>✓ العملة والسنة المالية أساس التقارير والنماذج</p>
              <p>✓ لا يتم نشر أي بيانات مالية قبل التحقق منها</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/40 sm:p-9">
            <div className="mb-8 flex items-center gap-3 text-xs font-bold">
              {[1, 2].map((item) => <div key={item} className="flex items-center gap-3"><span className={`flex h-7 w-7 items-center justify-center rounded-full ${step >= item ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-400"}`}>{item}</span>{item === 1 ? "المؤسسة" : "مصدر البيانات"}{item === 1 && <span className="h-px w-8 bg-slate-200" />}</div>)}
            </div>

            {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <label htmlFor="company" className="block text-sm font-bold text-slate-900">اسم المؤسسة</label>
                  <input id="company" value={company.name} onChange={(event) => updateCompany("name", event.target.value)} placeholder="مثال: شركة القائد" className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 outline-none transition focus:border-slate-500 focus:bg-white" />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block text-sm font-bold text-slate-900">الدولة
                    <select value={company.country} onChange={(event) => updateCompany("country", event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 font-normal outline-none focus:border-slate-500 focus:bg-white">
                      <option value="">اختر الدولة</option><option value="السعودية">السعودية</option><option value="الإمارات">الإمارات</option><option value="مصر">مصر</option><option value="دولة أخرى">دولة أخرى</option>
                    </select>
                  </label>
                  <label className="block text-sm font-bold text-slate-900">القطاع
                    <select value={company.industry} onChange={(event) => updateCompany("industry", event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 font-normal outline-none focus:border-slate-500 focus:bg-white">
                      <option value="">اختر القطاع</option><option value="تجارة وتوزيع">تجارة وتوزيع</option><option value="خدمات">خدمات</option><option value="تصنيع">تصنيع</option><option value="تقنية">تقنية</option><option value="أخرى">أخرى</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block text-sm font-bold text-slate-900">العملة الأساسية
                    <select value={company.currency} onChange={(event) => updateCompany("currency", event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 font-normal outline-none focus:border-slate-500 focus:bg-white">
                      <option value="SAR">ريال سعودي (SAR)</option><option value="AED">درهم إماراتي (AED)</option><option value="EGP">جنيه مصري (EGP)</option><option value="USD">دولار أمريكي (USD)</option>
                    </select>
                  </label>
                  <label className="block text-sm font-bold text-slate-900">بداية السنة المالية
                    <select value={company.fiscalYearStart} onChange={(event) => updateCompany("fiscalYearStart", event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 font-normal outline-none focus:border-slate-500 focus:bg-white">
                      <option value="يناير">يناير</option><option value="أبريل">أبريل</option><option value="يوليو">يوليو</option><option value="أكتوبر">أكتوبر</option>
                    </select>
                  </label>
                </div>
                <button type="button" onClick={() => setStep(2)} disabled={!canContinue} className="mt-3 w-full rounded-xl bg-slate-950 px-6 py-4 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">متابعة إلى مصدر البيانات</button>
              </div>
            ) : step === 2 ? (
              <div>
                <p className="text-sm font-bold text-slate-900">اختر نقطة البداية</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">يمكنك إضافة مصادر أخرى لاحقًا من مركز البيانات.</p>
                <div className="mt-5 grid gap-3">
                  {sources.map((item) => <button key={item.id} type="button" onClick={() => setSource(item.id)} className={`flex items-center justify-between rounded-xl border p-4 text-right transition ${source === item.id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"}`}><div><p className="font-bold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.description}</p></div><span className={`h-4 w-4 rounded-full border ${source === item.id ? "border-slate-900 bg-slate-900" : "border-slate-300"}`} /></button>)}
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-slate-200 px-6 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50">رجوع</button>
                  <button type="button" onClick={() => setStep(3)} className="rounded-xl bg-slate-950 px-6 py-4 text-sm font-bold text-white hover:bg-slate-800">إنشاء مساحة العمل</button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-xl text-white">✓</div>
                <h2 className="mt-6 text-2xl font-bold text-slate-950">تم إعداد {company.name}</h2>
                <p className="mt-3 leading-7 text-slate-500">العملة الأساسية: {company.currency} · بداية السنة المالية: {company.fiscalYearStart}</p>
                <p className="mt-2 text-sm text-slate-500">مصدر البداية: {sources.find((item) => item.id === source)?.title}</p>
                <a href="/workspace" className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-6 py-4 text-sm font-bold text-white hover:bg-slate-800">دخول إلى مساحة العمل</a>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
