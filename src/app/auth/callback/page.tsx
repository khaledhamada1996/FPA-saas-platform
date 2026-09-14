"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  if (value === "/start" || value === "/workspace") return value;

  // Invite callbacks are rebuilt from a restricted token alphabet. No URL,
  // protocol, host, query string, hash, or path supplied by the caller is
  // forwarded to the navigation sink.
  const prefix = "/invite/";
  if (value?.startsWith(prefix)) {
    const token = value.slice(prefix.length);
    if (/^[A-Za-z0-9_-]+$/.test(token)) {
      return `${prefix}${token}`;
    }
  }

  return "/start";
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;

    async function completeAuth() {
      try {
        const supabase = getSupabaseBrowserClient();
        const requestedNext = searchParams.get("next");
        const next = safeNextPath(requestedNext);
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;

        if (data.session) {
          router.replace(next);
        } else {
          router.replace("/login?confirmed=1");
        }
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
