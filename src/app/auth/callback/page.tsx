"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;

    async function completeEmailConfirmation() {
      const next = searchParams.get("next") || "/start";
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!active) return;
        if (data.session) {
          router.replace(next.startsWith("/") ? next : "/start");
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
  }, [router, searchParams]);

  return <main className="min-h-screen bg-[#f7f8fa] p-8 text-center text-slate-600" dir="rtl">جارٍ تأكيد البريد الإلكتروني…</main>;
}
