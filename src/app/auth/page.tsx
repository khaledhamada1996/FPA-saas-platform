import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AuthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/workspace");

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-card">
        <div className="auth-mark">ق</div>
        <p className="eyebrow">منصة القائد</p>
        <h1>الدخول إلى منصة التخطيط والتحليل المالي</h1>
        <p>سجّل الدخول للوصول إلى مساحة العمل المالية الخاصة بشركتك.</p>
        <form action="/auth/login" method="post" className="auth-form">
          <label>البريد الإلكتروني<input name="email" type="email" required autoComplete="email" /></label>
          <label>كلمة المرور<input name="password" type="password" required autoComplete="current-password" /></label>
          <button type="submit" className="primary-button">تسجيل الدخول</button>
        </form>
        <p className="auth-note">لا تملك حسابًا؟ أنشئ حسابًا من صفحة التسجيل.</p>
        <a href="/auth/signup" className="secondary-button">إنشاء حساب</a>
      </section>
    </main>
  );
}
