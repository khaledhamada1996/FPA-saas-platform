import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, slug, base_currency, fiscal_year_start_month)")
    .eq("user_id", user.id);

  if (memberships?.length) redirect("/dashboard");

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-card workspace-card">
        <div className="auth-mark">ق</div>
        <p className="eyebrow">الخطوة الأولى</p>
        <h1>أنشئ مساحة عمل شركتك</h1>
        <p>ستكون مساحة العمل معزولة عن بقية الشركات، ويُمنح حسابك صلاحية الإدارة عند الإنشاء.</p>
        <form action="/workspace/create" method="post" className="auth-form">
          <label>اسم الشركة<input name="name" type="text" required minLength={2} maxLength={120} placeholder="مثال: شركة النماء التجارية" /></label>
          <label>العملة الأساسية
            <select name="currency" defaultValue="SAR">
              <option value="SAR">ريال سعودي (SAR)</option>
              <option value="AED">درهم إماراتي (AED)</option>
              <option value="KWD">دينار كويتي (KWD)</option>
              <option value="QAR">ريال قطري (QAR)</option>
              <option value="BHD">دينار بحريني (BHD)</option>
              <option value="OMR">ريال عُماني (OMR)</option>
            </select>
          </label>
          <label>بداية السنة المالية
            <select name="fiscalMonth" defaultValue="1">
              {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
            </select>
          </label>
          <button type="submit" className="primary-button">إنشاء مساحة العمل</button>
        </form>
      </section>
    </main>
  );
}
