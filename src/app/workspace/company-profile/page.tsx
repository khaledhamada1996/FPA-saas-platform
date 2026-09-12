"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

type Profile = {
  id: string;
  name: string;
  legal_name: string | null;
  industry: string | null;
  company_size: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  tax_id: string | null;
  registration_number: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  base_currency: string;
  fiscal_year_start_month: number;
};

export default function CompanyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = getSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login?next=/workspace/company-profile");
        return;
      }
      const organizationId = window.sessionStorage.getItem("activeOrganizationId");
      if (!organizationId) {
        router.replace("/start");
        return;
      }
      const { data, error: rpcError } = await supabase.rpc("get_organization_context", { p_organization_id: organizationId });
      if (rpcError) {
        if (active) setError(rpcError.message);
        setLoading(false);
        return;
      }
      const next = data as Profile;
      if (!active) return;
      setProfile(next);
      setForm({
        name: next.name ?? "", legal_name: next.legal_name ?? "", industry: next.industry ?? "", company_size: next.company_size ?? "",
        country: next.country ?? "", city: next.city ?? "", address: next.address ?? "", tax_id: next.tax_id ?? "",
        registration_number: next.registration_number ?? "", website: next.website ?? "", contact_email: next.contact_email ?? "",
        contact_phone: next.contact_phone ?? "", base_currency: next.base_currency ?? "SAR", fiscal_year_start_month: String(next.fiscal_year_start_month ?? 1),
      });
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  function setField(key: string, value: string) {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const organizationId = window.sessionStorage.getItem("activeOrganizationId");
    if (!organizationId || !form.name?.trim()) {
      setError("اسم الشركة مطلوب.");
      return;
    }
    setSaving(true); setError(""); setSaved(false);
    const { error: rpcError } = await getSupabaseBrowserClient().rpc("update_company_profile", {
      p_organization_id: organizationId,
      p_name: form.name.trim(), p_legal_name: form.legal_name, p_industry: form.industry, p_company_size: form.company_size,
      p_country: form.country, p_city: form.city, p_address: form.address, p_tax_id: form.tax_id,
      p_registration_number: form.registration_number, p_website: form.website, p_contact_email: form.contact_email,
      p_contact_phone: form.contact_phone, p_base_currency: form.base_currency, p_fiscal_year_start_month: Number(form.fiscal_year_start_month),
    });
    setSaving(false);
    if (rpcError) { setError(rpcError.message); return; }
    setSaved(true);
    setProfile((current) => current ? { ...current, ...form, fiscal_year_start_month: Number(form.fiscal_year_start_month), base_currency: form.base_currency } as Profile : current);
  }

  if (loading) return <main className="min-h-screen bg-[#f7f8fa] p-6 text-[#172033]" dir="rtl"><div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-10 text-center">جارٍ تحميل ملف الشركة…</div></main>;
  if (!profile) return <main className="min-h-screen bg-[#f7f8fa] p-6 text-[#172033]" dir="rtl"><div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-800">{error || "تعذر تحميل ملف الشركة."}</div></main>;

  return <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"><Link href="/workspace" className="text-sm font-semibold text-slate-500 hover:text-slate-950">العودة لمساحة العمل</Link><div className="text-right"><p className="text-[10px] font-bold tracking-[0.14em] text-slate-400">COMPANY PROFILE</p><h1 className="mt-1 text-base font-bold text-slate-950 sm:text-lg">ملف الشركة</h1></div></div></header>
    <section className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8"><div className="border-b border-slate-200 pb-7"><p className="text-xs font-bold text-slate-400">إعدادات الشركة</p><h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">ملف الشركة والبيانات الأساسية</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500 sm:text-base">يمكنك تعديل بيانات الشركة في أي وقت. عند وجود أكثر من شركة، يتم حفظ هذه البيانات لكل شركة بشكل مستقل.</p></div>
      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      {saved && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">تم حفظ ملف الشركة بنجاح.</div>}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="grid gap-5 sm:grid-cols-2">
        <Field label="اسم الشركة *"><input className="input" value={form.name ?? ""} onChange={(e) => setField("name", e.target.value)} /></Field>
        <Field label="الاسم القانوني"><input className="input" value={form.legal_name ?? ""} onChange={(e) => setField("legal_name", e.target.value)} /></Field>
        <Field label="النشاط / القطاع"><input className="input" value={form.industry ?? ""} onChange={(e) => setField("industry", e.target.value)} /></Field>
        <Field label="حجم الشركة"><select className="input" value={form.company_size ?? ""} onChange={(e) => setField("company_size", e.target.value)}><option value="">غير محدد</option><option value="micro">متناهية الصغر</option><option value="small">صغيرة</option><option value="medium">متوسطة</option><option value="large">كبيرة</option></select></Field>
        <Field label="الدولة"><input className="input" value={form.country ?? ""} onChange={(e) => setField("country", e.target.value)} /></Field>
        <Field label="المدينة"><input className="input" value={form.city ?? ""} onChange={(e) => setField("city", e.target.value)} /></Field>
        <Field label="العنوان"><input className="input" value={form.address ?? ""} onChange={(e) => setField("address", e.target.value)} /></Field>
        <Field label="الرقم الضريبي"><input className="input" value={form.tax_id ?? ""} onChange={(e) => setField("tax_id", e.target.value)} /></Field>
        <Field label="رقم السجل التجاري"><input className="input" value={form.registration_number ?? ""} onChange={(e) => setField("registration_number", e.target.value)} /></Field>
        <Field label="الموقع الإلكتروني"><input className="input" value={form.website ?? ""} onChange={(e) => setField("website", e.target.value)} /></Field>
        <Field label="البريد الإلكتروني"><input className="input" type="email" value={form.contact_email ?? ""} onChange={(e) => setField("contact_email", e.target.value)} /></Field>
        <Field label="رقم التواصل"><input className="input" value={form.contact_phone ?? ""} onChange={(e) => setField("contact_phone", e.target.value)} /></Field>
        <Field label="العملة الأساسية"><select className="input" value={form.base_currency ?? "SAR"} onChange={(e) => setField("base_currency", e.target.value)}><option value="SAR">ريال سعودي (SAR)</option><option value="AED">درهم إماراتي (AED)</option><option value="USD">دولار أمريكي (USD)</option><option value="EGP">جنيه مصري (EGP)</option><option value="KWD">دينار كويتي (KWD)</option><option value="BHD">دينار بحريني (BHD)</option><option value="QAR">ريال قطري (QAR)</option><option value="OMR">ريال عماني (OMR)</option></select></Field>
        <Field label="بداية السنة المالية"><select className="input" value={form.fiscal_year_start_month ?? "1"} onChange={(e) => setField("fiscal_year_start_month", e.target.value)}>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></Field>
      </div><div className="mt-7 border-t border-slate-100 pt-6"><button type="button" disabled={saving} onClick={() => void save()} className="w-full rounded-xl bg-slate-950 px-6 py-4 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{saving ? "جارٍ الحفظ…" : "حفظ التعديلات"}</button></div></section>
    </section>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>; }
