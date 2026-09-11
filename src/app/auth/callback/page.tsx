"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function completeSignIn() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) throw error;
      } finally {
        router.replace("/start");
      }
    }

    void completeSignIn();
  }, [router]);

  return <main className="min-h-screen bg-[#f7f8fa] p-8 text-center text-slate-600" dir="rtl">جارٍ تأكيد تسجيل الدخول…</main>;
}
