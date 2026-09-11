"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const months = [
  { value: "1", label: "يناير" }, { value: "2", label: "فبراير" }, { value: "3", label: "مارس" },
  { value: "4", label: "أبريل" }, { value: "5", label: "مايو" }, { value: "6", label: "يونيو" },
  { value: "7", label: "يوليو" }, { value: "8", label: "أغسطس" }, { value: "9", label: "سبتمبر" },
  { value: "10", label: "أكتوبر" }, { value: "11", label: "نوفمبر" }, { value: "12", label: "ديسمبر" },
];

const sources = [
  { id: "excel", title: "Excel أو CSV", description: "رفع بياناتك من ملف منظم بعد إعداد المؤسسة" },
  { id: "manual", title: "إدخال يدوي", description: "إضافة البيانات مباشرة من داخل مساحة العمل" },
  { id: "integration", title: "ربط نظام", description: "ربط نظام محاسبي أو تشغيلي في خطوة لاحقة" },
];

type CompanyProfile = {
  name: string;
  legalName: string;
  country: string;
  city: string;
  address: string;
  industry: string;
  companySize: string;
  currency: string;
  fiscalYearStartMonth: string;
  taxId: string;
  registrationNumber: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
};

const emptyCompany: CompanyProfile = {
  name: "", legalName: "", country: "", city: "", address: "", industry: "", companySize: "",
  currency: "", fiscalYearStartMonth: "", taxId: "", registrationNumber: "", website: "",
  contactEmail: "", contactPhone: "",
};

export default function StartPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [company, setCompany] = useState<CompanyProfile>(emptyCompany);
  const [source, setSource] = useState("excel");
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();
      void supabase.auth.getUser().then(({ data }) => setAuthState(data.user ? "authenticated" : "unauthenticated"));
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setAuthState(session?.user ? "authenticated" : "unauthenticated"));
      return () => listener.subscription.unsubscribe();
    } catch {
      setAuthState("unauthenticated");
    }
  }, []);

  function updateCompany(field: keyof CompanyProfile, value: string) {
    setCompany((current) => ({ ...current, [field]: value }));
  }

  async function createWorkspace() {
    setSaving(true);
    setSaveError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("سجّل الدخول أولًا لحفظ بيانات المؤسسة.");

      const { data, error } = await supabase.rpc("create_workspace", {
        p_name: company.name || null,
        p_base_currency: company.currency || "SAR",
        p_fiscal_year_start_month: Number(company.fiscalYearStartMonth) || 1,
        p_company_profile: {
          legal_name: company.legalName,
          country: company.country,
          city: company.city,
          address: company.address,
          industry: company.industry,
          company_size: company.companySize,
          tax_id: company.taxId,
          registration_number: company.registrationNumber,
          website: company.website,
          contact_email: company.contactEmail,
          contact_phone: company.contactPhone,
          initial_data_source: source,
        },
      });

      if (error) throw error;
      if (!data) throw new Error("تعذر إنشاء المؤسسة. حاول مرة أخرى.");

      window.sessionStorage.setItem("activeOrganizationId", data);
      setStep(3);
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : "تعذر حفظ بيانات المؤسسة.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 lg:px-10">
          <a href="/" className="text-sm font-semibold text-slate-500 hover:text-slate-900">العودة للصفحة الرئيسية</a>
          <div className="text-right"><div className="font-bold text-slate-950">FP&A</div><div className="text-xs text-slate-400">إعداد مساحة العمل</div></div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-24">
        {authState === "loading" ? (
          <p className="text-center text-slate-500">جارٍ التحقق من تسجيل الدخول…</p>
        ) : authState === "unauthenticated" ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/40 sm:p-12">
            <p className="text-xs font-bold tracking-[0.14em] text-slate-400">SECURE WORKSPACE</p>
            <h1 className="mt-4 text-3xl font-bold text-slate-950">سجّل الدخول قبل إعداد المؤسسة</h1>
            <p className="mt-4 leading-8 text-slate-500">نحفظ معلومات المؤسسة ضمن حساب مالكها فقط. لن تُخزَّن في المتصفح أو تُتاح لمستخدم آخر.</p>
            <a href="/login" className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-6 py-4 font-bold text-white hover:bg-slate-800">تسجيل الدخول</a>
          </div>
        ) : (
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-bold tracking-[0.14em] text-slate-400">START YOUR WORKSPACE</p>
              <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
                {step === 1 ? "عرّف مؤسستك كما تريد" : step === 2 ? "كيف تريد إضافة بياناتك؟" : "تم حفظ مؤسستك"}
              </h1>
              <p className="mt-5 leading-8 text-slate-500">
                {step === 1 ? "كل الحقول اختيارية ويمكنك إكمالها أو تعديلها لاحقًا. تُربط المؤسسة بحسابك قبل إدخال أي بيانات مالية."
                  : step === 2 ? "اختر نقطة بداية مبدئية فقط؛ يمكنك تغييرها أو إضافة مصادر جديدة لاحقًا."
                    : "تم إنشاء مساحة عمل خاصة بمؤسستك وحفظ بياناتها بأمان ضمن حسابك."}
              </p>
              <div className="mt-8 space-y-4 text-sm text-slate-600">
                <p>✓ جميع معلومات المؤسسة اختيارية</p>
                <p>✓ اختر أي شهر من شهور السنة لبداية السنة المالية</p>
                <p>✓ لا يبدأ الاستيراد أو الربط قبل اختيارك في الخطوة التالية</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/40 sm:p-9">
              {step < 3 && <div className="mb-8 flex items-center gap-3 text-xs font-bold">
                {[1, 2].map((item) => <div key={item} className="flex items-center gap-3"><span className={`flex h-7 w-7 items-center justify-center rounded-full ${step >= item ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-400"}`}>{item}</span>{item === 1 ? "المؤسسة" : "مصدر البيانات"}{item === 1 && <span className="h-px w-8 bg-slate-200" />}</div>)}
              </div>}

              {step === 1 ? (
                <div className="space-y-7">
                  <fieldset><legend className="text-sm font-bold text-slate-900">تعريف المؤسسة</legend>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field label="اسم العرض"><input value={company.name} onChange={(event) => updateCompany("name", event.target.value)} placeholder="مثال: شركة القائد" className="input" /></Field>
                      <Field label="الاسم القانوني"><input value={company.legalName} onChange={(event) => updateCompany("legalName", event.target.value)} placeholder="إن وجد" className="input" /></Field>
                      <Field label="القطاع"><input value={company.industry} onChange={(event) => updateCompany("industry", event.target.value)} placeholder="مثال: تجارة وتوزيع" className="input" /></Field>
                      <Field label="حجم المؤسسة"><input value={company.companySize} onChange={(event) => updateCompany("companySize", event.target.value)} placeholder="مثال: 11–50 موظفًا" className="input" /></Field>
                    </div>
                  </fieldset>

                  <fieldset><legend className="text-sm font-bold text-slate-900">الموقع والتواصل</legend>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field label="الدولة"><input value={company.country} onChange={(event) => updateCompany("country", event.target.value)} className="input" /></Field>
                      <Field label="المدينة"><input value={company.city} onChange={(event) => updateCompany("city", event.target.value)} className="input" /></Field>
                      <Field label="البريد الإلكتروني"><input type="email" value={company.contactEmail} onChange={(event) => updateCompany("contactEmail", event.target.value)} className="input" dir="ltr" /></Field>
                      <Field label="رقم الهاتف"><input value={company.contactPhone} onChange={(event) => updateCompany("contactPhone", event.target.value)} className="input" dir="ltr" /></Field>
                      <Field label="الموقع الإلكتروني"><input type="url" value={company.website} onChange={(event) => updateCompany("website", event.target.value)} className="input" dir="ltr" /></Field>
                      <Field label="العنوان"><input value={company.address} onChange={(event) => updateCompany("address", event.target.value)} className="input" /></Field>
                    </div>
                  </fieldset>

                  <fieldset><legend className="text-sm font-bold text-slate-900">البيانات النظامية والمالية</legend>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field label="الرقم الضريبي"><input value={company.taxId} onChange={(event) => updateCompany("taxId", event.target.value)} className="input" /></Field>
                      <Field label="رقم السجل التجاري"><input value={company.registrationNumber} onChange={(event) => updateCompany("registrationNumber", event.target.value)} className="input" /></Field>
                      <Field label="العملة الأساسية"><select value={company.currency} onChange={(event) => updateCompany("currency", event.target.value)} className="input"><option value="">غير محددة — سيستخدم النظام SAR مؤقتًا</option><option value="SAR">ريال سعودي (SAR)</option><option value="AED">درهم إماراتي (AED)</option><option value="EGP">جنيه مصري (EGP)</option><option value="USD">دولار أمريكي (USD)</option><option value="EUR">يورو (EUR)</option></select></Field>
                      <Field label="بداية السنة المالية"><select value={company.fiscalYearStartMonth} onChange={(event) => updateCompany("fiscalYearStartMonth", event.target.value)} className="input"><option value="">غير محددة — سيستخدم النظام يناير مؤقتًا</option>{months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}</select></Field>
                    </div>
                  </fieldset>

                  <button type="button" onClick={() => setStep(2)} className="w-full rounded-xl bg-slate-950 px-6 py-4 font-bold text-white transition hover:bg-slate-800">متابعة إلى مصدر البيانات</button>
                </div>
              ) : step === 2 ? (
                <div>
                  <p className="text-sm font-bold text-slate-900">اختر نقطة البداية</p>
                  <div className="mt-5 grid gap-3">{sources.map((item) => <button key={item.id} type="button" onClick={() => setSource(item.id)} className={`flex items-center justify-between rounded-xl border p-4 text-right transition ${source === item.id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"}`}><div><p className="font-bold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.description}</p></div><span className={`h-4 w-4 rounded-full border ${source === item.id ? "border-slate-900 bg-slate-900" : "border-slate-300"}`} /></button>)}</div>
                  {saveError && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{saveError}</p>}
                  <div className="mt-8 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setStep(1)} disabled={saving} className="rounded-xl border border-slate-200 px-6 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50">رجوع</button><button type="button" onClick={() => void createWorkspace()} disabled={saving} className="rounded-xl bg-slate-950 px-6 py-4 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300">{saving ? "جارٍ حفظ المؤسسة..." : "حفظ وإنشاء مساحة العمل"}</button></div>
                </div>
              ) : (
                <div className="text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-xl text-white">✓</div><h2 className="mt-6 text-2xl font-bold text-slate-950">تم حفظ معلومات المؤسسة</h2><p className="mt-3 leading-7 text-slate-500">يمكنك تعديلها لاحقًا، ثم البدء في بناء الهيكل المالي وإضافة البيانات.</p><a href="/workspace" className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-6 py-4 text-sm font-bold text-white hover:bg-slate-800">دخول إلى مساحة العمل</a></div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-bold text-slate-900">{label}<span className="mr-2 text-xs font-normal text-slate-400">اختياري</span><div className="mt-2">{children}</div></label>;
}
