"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("sending");

    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/start`;
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });

      if (signInError) throw signInError;
      setStatus("sent");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "تعذر إرسال رابط الدخول.");
      setStatus("idle");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-6 py-16 text-[#172033]" dir="rtl">
      <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40 sm:p-10">
        <a href="/" className="text-sm font-semibold text-slate-500 hover:text-slate-900">العودة للصفحة الرئيسية</a>
        <p className="mt-10 text-xs font-bold tracking-[0.14em] text-slate-400">SECURE WORKSPACE</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">سجّل الدخول لحفظ مؤسستك</h1>
        <p className="mt-4 leading-7 text-slate-500">سنربط المؤسسة بحسابك حتى لا يتمكن أي مستخدم آخر من الاطلاع على بياناتها أو تعديلها.</p>

        {status === "sent" ? (
          <div className="mt-8 rounded-2xl bg-emerald-50 p-5 text-sm leading-7 text-emerald-800">أرسلنا رابط دخول إلى بريدك. افتحه من البريد نفسه لإكمال الدخول والعودة إلى إعداد المؤسسة.</div>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={sendMagicLink}>
            <label className="block text-sm font-bold text-slate-900">البريد الإلكتروني
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@company.com" className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left outline-none transition focus:border-slate-500 focus:bg-white" dir="ltr" />
            </label>
            {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={!email.trim() || status === "sending"} className="w-full rounded-xl bg-slate-950 px-6 py-4 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">{status === "sending" ? "جارٍ إرسال الرابط..." : "إرسال رابط الدخول"}</button>
          </form>
        )}
      </section>
    </main>
  );
}
