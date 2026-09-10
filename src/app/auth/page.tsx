import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginStatus from "./LoginStatus";

type AuthPageProps = {
  searchParams: Promise<{
    error?: string;
    retry?: string;
    attempts?: string;
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/workspace");

  const params = await searchParams;
  const locked = Math.max(0, Number.parseInt(params.retry ?? "0", 10) || 0) > 0;

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-card">
        <div className="auth-mark">ق</div>
        <p className="eyebrow">منصة القائد</p>
        <h1>الدخول إلى منصة التخطيط والتحليل المالي</h1>
        <p>سجّل الدخول للوصول إلى مساحة العمل المالية الخاصة بشركتك.</p>

        <LoginStatus error={params.error} retry={params.retry} attempts={params.attempts} />

        {!locked && (
          <form action="/auth/login/submit" method="post" className="auth-form">
            <label>البريد الإلكتروني<input name="email" type="email" required autoComplete="email" /></label>
            <label>كلمة المرور<input name="password" type="password" required autoComplete="current-password" /></label>
            <button type="submit" className="primary-button">تسجيل الدخول</button>
          </form>
        )}

        <p className="auth-note">لا تملك حسابًا؟ ابدأ الآن وأنشئ مساحة العمل الخاصة بك.</p>
        <a href="/auth/signup" className="secondary-button">ابدأ الآن</a>
      </section>
    </main>
  );
}
