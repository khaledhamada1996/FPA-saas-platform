"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "authenticated">("loading");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (data.user) {
        setStatus("authenticated");
      } else {
        router.replace("/login?next=/workspace");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setStatus("authenticated");
      } else {
        router.replace("/login?next=/workspace");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
            <p className="text-xs font-bold tracking-[0.16em] text-slate-400">FP&A WORKSPACE</p>
            <p className="mt-4 text-base font-semibold text-slate-800">جارٍ التحقق من تسجيل الدخول…</p>
          </div>
        </div>
      </main>
    );
  }

  return children;
}
