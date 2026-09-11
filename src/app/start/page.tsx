"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const months = [
  ["1", "يناير"], ["2", "فبراير"], ["3", "مارس"], ["4", "أبريل"],
  ["5", "مايو"], ["6", "يونيو"], ["7", "يوليو"], ["8", "أغسطس"],
  ["9", "سبتمبر"], ["10", "أكتوبر"], ["11", "نوفمبر"], ["12", "ديسمبر"],
] as const;

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
  name: "",
  legalName: "",
  country: "",
  city: "",
  address: "",
  industry: "",
  companySize: "",
  currency: "",
  fiscalYearStartMonth: "",
  taxId: "",
  registrationNumber: "",
  website: "",
  contactEmail: "",
  contactPhone: "",
};

export default function StartPage() {
  const router = useRouter();
  const [company, setCompany] = useState<CompanyProfile>(emptyCompany);
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (data.user) {
        setAuthState("authenticated");
      } else {
        setAuthState("unauthenticated");
        router.replace("/login?next=/start");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setAuthState("authenticated");
      } else {
        setAuthState("unauthenticated");
        router.replace("/login?next=/start");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  function updateCompany(field: keyof CompanyProfile, value: string) {
    setCompany((current) => ({ ...current, [field]: value }));
  }

  async function createWorkspace() {
    setSaving(true);
    setSaveError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) {
        router.replace("/login?next=/start");
        return;
      }

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
        },
      });

      if (error) throw error;
      if (!data) throw new Error("تعذر إنشاء المؤسسة. حاول مرة أخرى.");

      window.sessionStorage.setItem("activeOrganizationId", String(data));
      router.replace("/workspace");
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : "تعذر حفظ بيانات المؤسسة.");
    } finally {
      setSaving(false);
    }
  }

  if (authState !== "authenticated") {
    return (
      <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
            <p className="text-xs font-bold tracking-[0.16em] text-slate-400">FP&A WORKSPACE</p>
            <p className="mt-4 text-base font-semibold text-slate-800">
              {authState === "loading" ? "جارٍ التحقق من تسجيل الدخول…" : "جارٍ تحويلك إلى تسجيل الدخول…"}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="text-sm font-semibold text-slate-500 transition hover:text-slate-950">الصفحة الرئيسية</a>
          <div className="text-right">
            <div className="text-base font-bold text-slate-950">FP&A</div>
            <div className="text-xs text-slate-400">إعداد مساحة العمل</div>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-12 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="lg:sticky lg:top-8">
            <p className="text-xs font-bold tracking-[0.16em] text-slate-400">STEP 01 · WORKSPACE</p>
            <h1 className="mt-3 max-w-xl text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-[2.7rem]">
              عرّف مؤسستك قبل بدء العمل المالي
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-500 sm:text-base sm:leading-8">
              هذه الخطوة مخصصة لإنشاء مساحة العمل وربطها بحسابك. الاستيراد والمطابقة والميزانية والتوقعات تظهر داخل مساحة العمل بعد إنشاء المؤسسة، وليست جزءًا من نموذج تعريف المؤسسة.
            </p>

            <div className="mt-7 space-y-3 text-sm text-slate-600">
              <div className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />إعداد السنة المالية والعملة الأساسية</div>
              <div className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />حفظ بيانات المؤسسة ضمن حسابك</div>
              <div className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />بعد الحفظ تنتقل إلى قائمة وحدات FP&A</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:p-9">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-bold text-slate-400">ORGANIZATION</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">معلومات المؤسسة</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">الخطوة 1</span>
            </div>

            <div className="mt-7 space-y-8">
              <fieldset>
                <legend className="text-sm font-bold text-slate-900">تعريف المؤسسة</legend>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <Field label="اسم العرض"><input value={company.name} onChange={(event) => updateCompany("name", event.target.value)} placeholder="مثال: شركة القائد" className="input" /></Field>
                  <Field label="الاسم القانوني"><input value={company.legalName} onChange={(event) => updateCompany("legalName", event.target.value)} placeholder="إن وجد" className="input" /></Field>
                  <Field label="القطاع"><input value={company.industry} onChange={(event) => updateCompany("industry", event.target.value)} placeholder="مثال: تجارة وتوزيع" className="input" /></Field>
                  <Field label="حجم المؤسسة"><input value={company.companySize} onChange={(event) => updateCompany("companySize", event.target.value)} placeholder="مثال: 11–50 موظفًا" className="input" /></Field>
                </div>
              </fieldset>

              <fieldset className="border-t border-slate-100 pt-7">
                <legend className="text-sm font-bold text-slate-900">الموقع والتواصل</legend>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <Field label="الدولة"><input value={company.country} onChange={(event) => updateCompany("country", event.target.value)} placeholder="السعودية" className="input" /></Field>
                  <Field label="المدينة"><input value={company.city} onChange={(event) => updateCompany("city", event.target.value)} className="input" /></Field>
                  <Field label="البريد الإلكتروني"><input type="email" value={company.contactEmail} onChange={(event) => updateCompany("contactEmail", event.target.value)} className="input" dir="ltr" /></Field>
                  <Field label="رقم الهاتف"><input value={company.contactPhone} onChange={(event) => updateCompany("contactPhone", event.target.value)} className="input" dir="ltr" /></Field>
                  <Field label="الموقع الإلكتروني"><input type="url" value={company.website} onChange={(event) => updateCompany("website", event.target.value)} className="input" dir="ltr" /></Field>
                  <Field label="العنوان"><input value={company.address} onChange={(event) => updateCompany("address", event.target.value)} className="input" /></Field>
                </div>
              </fieldset>

              <fieldset className="border-t border-slate-100 pt-7">
                <legend className="text-sm font-bold text-slate-900">البيانات النظامية والمالية</legend>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <Field label="الرقم الضريبي"><input value={company.taxId} onChange={(event) => updateCompany("taxId", event.target.value)} className="input" /></Field>
                  <Field label="رقم السجل التجاري"><input value={company.registrationNumber} onChange={(event) => updateCompany("registrationNumber", event.target.value)} className="input" /></Field>
                  <Field label="العملة الأساسية">
                    <select value={company.currency} onChange={(event) => updateCompany("currency", event.target.value)} className="input">
                      <option value="">غير محددة — سيستخدم النظام SAR مؤقتًا</option>
                      <option value="SAR">ريال سعودي (SAR)</option>
                      <option value="AED">درهم إماراتي (AED)</option>
                      <option value="EGP">جنيه مصري (EGP)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                      <option value="EUR">يورو (EUR)</option>
                    </select>
                  </Field>
                  <Field label="بداية السنة المالية">
                    <select value={company.fiscalYearStartMonth} onChange={(event) => updateCompany("fiscalYearStartMonth", event.target.value)} className="input">
                      <option value="">غير محددة — سيستخدم النظام يناير مؤقتًا</option>
                      {months.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </Field>
                </div>
              </fieldset>

              {saveError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700" role="alert">
                  {saveError}
                </div>
              )}

              <div className="border-t border-slate-100 pt-6">
                <button type="button" onClick={() => void createWorkspace()} disabled={saving} className="w-full rounded-xl bg-slate-950 px-6 py-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? "جارٍ إنشاء مساحة العمل…" : "إنشاء مساحة العمل والمتابعة"}
                </button>
                <p className="mt-3 text-center text-xs leading-5 text-slate-400">بعد الإنشاء ستنتقل إلى مساحة العمل، ومنها تختار البيانات والاستيراد ثم بقية وحدات FP&A.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
