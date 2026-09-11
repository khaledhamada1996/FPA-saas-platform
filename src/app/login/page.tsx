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
      router.replace("/start");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "تعذر تسجيل الدخول.");
      setStatus("idle");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-6 py-16 text-[#172033]" dir="rtl">
      <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40 sm:p-10">
        <a href="/" className="text-sm font-semibold text-slate-500 hover:text-slate-900">العودة للصفحة الرئيسية</a>
        <p className="mt-10 text-xs font-bold tracking-[0.14em] text-slate-400">SECURE WORKSPACE</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">تسجيل الدخول</h1>
        <p className="mt-4 leading-7 text-slate-500">استخدم بريدك الإلكتروني وكلمة المرور للدخول إلى مساحة العمل.</p>
        <form className="mt-8 space-y-5" onSubmit={signIn}>
          <label className="block text-sm font-bold text-slate-900">البريد الإلكتروني
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@company.com" className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left outline-none transition focus:border-slate-500 focus:bg-white" dir="ltr" />
          </label>
          <label className="block text-sm font-bold text-slate-900">كلمة المرور
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="••••••••" className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left outline-none transition focus:border-slate-500 focus:bg-white" dir="ltr" />
          </label>
          {error && <p className="rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">{error}</p>}
          <button type="submit" disabled={!email.trim() || !password || status === "loading"} className="w-full rounded-xl bg-slate-950 px-6 py-4 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">{status === "loading" ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">ليس لديك حساب؟ <a href="/signup" className="font-bold text-slate-900 hover:underline">إنشاء حساب</a></p>
      </section>
    </main>
  );
}
