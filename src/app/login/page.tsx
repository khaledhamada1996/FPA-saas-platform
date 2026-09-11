"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("loading");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const next = requestedNext && requestedNext.startsWith("/") ? requestedNext : "/start";
      router.replace(next);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "تعذر تسجيل الدخول.");
      setStatus("idle");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-10 text-[#172033] sm:px-6 sm:py-16" dir="rtl">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:rounded-3xl sm:p-10">
        <a href="/" className="text-sm font-semibold text-slate-500 transition hover:text-slate-900">العودة للصفحة الرئيسية</a>
        <p className="mt-8 text-xs font-bold tracking-[0.14em] text-slate-400 sm:mt-10">SECURE WORKSPACE</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">تسجيل الدخول</h1>
        <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">استخدم بريدك الإلكتروني وكلمة المرور للدخول إلى مساحة العمل.</p>
        <form className="mt-7 space-y-5 sm:mt-8" onSubmit={signIn}>
          <label className="block text-sm font-bold text-slate-900">البريد الإلكتروني
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@company.com" className="input mt-2" dir="ltr" />
          </label>
          <label className="block text-sm font-bold text-slate-900">كلمة المرور
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="••••••••" className="input mt-2" dir="ltr" />
          </label>
          {error && <p className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700" role="alert">{error}</p>}
          <button type="submit" disabled={!email.trim() || !password || status === "loading"} className="w-full rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:py-4">{status === "loading" ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">ليس لديك حساب؟ <a href="/signup" className="font-bold text-slate-900 hover:underline">إنشاء حساب</a></p>
      </section>
    </main>
  );
}
