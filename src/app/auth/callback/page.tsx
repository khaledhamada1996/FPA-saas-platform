"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function completeEmailConfirmation() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;

        if (data.session) {
          router.replace("/start");
        } else {
          router.replace("/login?confirmed=1");
        }
      } catch {
        if (active) router.replace("/login?error=confirmation");
      }
    }

    void completeEmailConfirmation();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-5 text-center text-slate-600" dir="rtl">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="font-semibold text-slate-900">جارٍ تأكيد البريد الإلكتروني…</p>
        <p className="mt-2 text-sm">يرجى الانتظار لحظات.</p>
      </div>
    </main>
  );
}
