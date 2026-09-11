"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState("");

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    if (password.length < 6) {
      setError("يجب أن تتكون كلمة المرور من 6 أحرف أو أكثر.");
      return;
    }

    setStatus("loading");
    try {
      const supabase = getSupabaseBrowserClient();
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=/start`;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo },
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        window.location.replace("/start");
        return;
      }

      setStatus("sent");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "تعذر إنشاء الحساب.");
      setStatus("idle");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-6 py-16 text-[#172033]" dir="rtl">
      <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40 sm:p-10">
        <a href="/" className="text-sm font-semibold text-slate-500 hover:text-slate-900">العودة للصفحة الرئيسية</a>
        <p className="mt-10 text-xs font-bold tracking-[0.14em] text-slate-400">CREATE YOUR WORKSPACE</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">إنشاء حساب جديد</h1>
        <p className="mt-4 leading-7 text-slate-500">أنشئ حسابك باستخدام بريدك الإلكتروني وكلمة المرور ثم أكد بريدك الإلكتروني من الرسالة التي سنرسلها إليك.</p>

        {status === "sent" ? (
          <div className="mt-8 rounded-2xl bg-emerald-50 p-5 text-sm leading-7 text-emerald-800">
            <p className="font-bold">تم إنشاء الحساب بنجاح</p>
            <p className="mt-2">أرسلنا رسالة تأكيد إلى بريدك الإلكتروني. افتح الرسالة واضغط على زر تأكيد البريد الإلكتروني لإكمال التسجيل.</p>
            <p className="mt-2 text-emerald-700">إذا لم تجد الرسالة، تحقق من مجلد الرسائل غير المرغوب فيها.</p>
          </div>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={signUp}>
            <label className="block text-sm font-bold text-slate-900">البريد الإلكتروني
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@company.com" className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left outline-none transition focus:border-slate-500 focus:bg-white" dir="ltr" />
            </label>
            <label className="block text-sm font-bold text-slate-900">كلمة المرور
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} placeholder="••••••••" className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left outline-none transition focus:border-slate-500 focus:bg-white" dir="ltr" />
            </label>
            <label className="block text-sm font-bold text-slate-900">تأكيد كلمة المرور
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} placeholder="••••••••" className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left outline-none transition focus:border-slate-500 focus:bg-white" dir="ltr" />
            </label>
            {error && <p className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">{error}</p>}
            <button type="submit" disabled={!email.trim() || !password || !confirmPassword || status === "loading"} className="w-full rounded-xl bg-slate-950 px-6 py-4 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">{status === "loading" ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}</button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">لديك حساب بالفعل؟ <a href="/login" className="font-bold text-slate-900 hover:underline">تسجيل الدخول</a></p>
      </section>
    </main>
  );
}
