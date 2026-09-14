"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  if (!value) return "/start";

  try {
    const url = new URL(value, window.location.origin);

    // Only allow redirects back to this application.
    if (url.origin !== window.location.origin) return "/start";
    if (url.username || url.password) return "/start";
    if (url.pathname.includes("\\")) return "/start";

    // Keep the callback destination limited to routes used by the auth flow.
    const isAllowedRoute =
      url.pathname === "/start" ||
      url.pathname === "/workspace" ||
      url.pathname.startsWith("/invite/");

    if (!isAllowedRoute) return "/start";

    // Rebuild the destination from the validated URL rather than returning the
    // raw query-string value to router.replace().
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/start";
  }
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;

    async function completeAuth() {
      try {
        const supabase = getSupabaseBrowserClient();
        const next = safeNextPath(searchParams.get("next"));
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
