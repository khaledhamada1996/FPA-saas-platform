"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function NewCompanyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [fiscalMonth, setFiscalMonth] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createCompany() {
    if (!name.trim()) {
      setError("اكتب اسم الشركة أولًا.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login?next=/start");
        return;
      }

      const { data, error: rpcError } = await supabase.rpc("create_workspace", {
        p_name: name.trim(),
        p_base_currency: currency,
        p_fiscal_year_start_month: Number(fiscalMonth),
        p_company_profile: {
          legal_name: legalName.trim(),
          industry: industry.trim(),
          city: city.trim(),
          country: "السعودية",
        },
      });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("تعذر إنشاء الشركة.");

      window.sessionStorage.setItem("activeOrganizationId", String(data));
      router.replace("/workspace");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إنشاء الشركة.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-6 text-[#172033] sm:px-6 lg:px-10" dir="rtl">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between border-b border-slate-200 pb-5">
          <button type="button" onClick={() => router.push("/start")} className="text-sm font-semibold text-slate-500 hover:text-slate-950">← العودة إلى شركاتي</button>
          <div className="text-right"><p className="text-xs font-bold tracking-[0.16em] text-slate-400">NEW COMPANY</p><p className="mt-1 font-bold text-slate-950">إضافة شركة جديدة</p></div>
        </header>

        <section className="mx-auto max-w-3xl py-8 sm:py-12 lg:py-16">
          <div className="mb-8">
            <p className="text-xs font-bold tracking-[0.14em] text-slate-400">COMPANY SETUP</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">أنشئ مساحة الشركة</h1>
            <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base">هذه الشاشة تظهر فقط عند الضغط على «إضافة شركة». بعد الإنشاء ستدخل مباشرة إلى مساحة الشركة، ويمكنك لاحقًا دعوة الفريق وتحديد صلاحيات كل مستخدم.</p>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="اسم الشركة *"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: شركة القائد للتجارة" autoFocus /></Field>
              <Field label="الاسم القانوني"><input className="input" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="إن وجد" /></Field>
              <Field label="القطاع"><input className="input" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="مثال: تجارة وتوزيع" /></Field>
              <Field label="المدينة"><input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="الرياض" /></Field>
              <Field label="العملة الأساسية"><select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="SAR">ريال سعودي (SAR)</option><option value="AED">درهم إماراتي (AED)</option><option value="USD">دولار أمريكي (USD)</option><option value="EGP">جنيه مصري (EGP)</option></select></Field>
              <Field label="بداية السنة المالية"><select className="input" value={fiscalMonth} onChange={(e) => setFiscalMonth(e.target.value)}>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></Field>
            </div>

            {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700" role="alert">{error}</div>}

            <div className="mt-8 border-t border-slate-100 pt-6">
              <button type="button" disabled={saving} onClick={() => void createCompany()} className="w-full rounded-xl bg-slate-950 px-6 py-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? "جارٍ إنشاء الشركة…" : "إنشاء الشركة والدخول إليها"}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-slate-400">سيتم تسجيلك كمسؤول عن الشركة تلقائيًا، ثم يمكنك إدارة أعضاء الفريق وصلاحياتهم.</p>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>;
}
