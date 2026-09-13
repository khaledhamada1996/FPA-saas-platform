"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IntegrationsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/workspace/data-monitoring/connectors");
  }, [router]);
  return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#f7f8fa] text-sm text-slate-500">جارٍ فتح إدارة موصلات البيانات…</main>;
}
