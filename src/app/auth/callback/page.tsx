"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;

    async function completeAuth() {
      try {
        const supabase = getSupabaseBrowserClient();
        const next = searchParams.get("next") || "/start";
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;

        router.replace(data.session ? next : "/login?confirmed=1");
      } catch {
        if (active) router.replace("/login?error=confirmation");
      }
    }

    void completeAuth();
    return () => {
      active = false;
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-5 text-center text-slate-600" dir="rtl">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="font-semibold text-slate-900">جارٍ تأكيد تسجيل الدخول…</p>
        <p className="mt-2 text-sm">يرجى الانتظار لحظات.</p>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-5 text-center text-slate-600" dir="rtl">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="font-semibold text-slate-900">جارٍ تجهيز الجلسة…</p>
          </div>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
