import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SignUpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/workspace");

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-card">
        <div className="auth-mark">ق</div>
        <p className="eyebrow">منصة القائد</p>
        <h1>إنشاء حساب جديد</h1>
        <p>أنشئ حسابك ثم أنشئ مساحة العمل الخاصة بشركتك.</p>
        <form action="/auth/signup" method="post" className="auth-form">
          <label>البريد الإلكتروني<input name="email" type="email" required autoComplete="email" /></label>
          <label>كلمة المرور<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
          <button type="submit" className="primary-button">إنشاء الحساب</button>
        </form>
        <a href="/auth" className="secondary-button">لدي حساب بالفعل</a>
      </section>
    </main>
  );
}
