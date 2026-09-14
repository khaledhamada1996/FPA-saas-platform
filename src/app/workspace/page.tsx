"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Company = { id: string; name: string; role: string; role_key: string };
const roles: Record<string, string> = { company_admin: "مدير النظام", admin: "مدير النظام", owner: "المالك", ceo: "الرئيس التنفيذي", cfo: "المدير المالي", finance_manager: "مدير مالي", fpa_analyst: "محلل FP&A", accountant: "محاسب", viewer: "مطلع", planner: "محلل FP&A" };

export default function WorkspacePage() {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let alive = true;
    async function load() {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) { router.replace("/login?next=/workspace"); return; }
      const { data, error } = await supabase.rpc("get_my_workspaces");
      if (error || !data?.length) { router.replace("/start"); return; }
      const list = data as Company[];
      const activeId = window.sessionStorage.getItem("activeOrganizationId");
      const active = list.find((item) => item.id === activeId) ?? list[0];
      window.sessionStorage.setItem("activeOrganizationId", active.id);
      window.sessionStorage.setItem("selectedOrganizationIds", JSON.stringify([active.id]));
      if (alive) { setCompany(active); setLoading(false); }
    }
    void load();
    return () => { alive = false; };
  }, [router]);

  if (loading || !company) return <section className="flex min-h-[calc(100vh-84px)] items-center justify-center px-6 text-sm text-slate-500">جارٍ تحميل مساحة العمل…</section>;

  return <section className="p-6 sm:p-8 lg:p-10" dir="rtl">
    <div className="border-b border-slate-200 pb-7">
      <p className="text-xs font-bold tracking-[.16em] text-slate-400">WORKSPACE</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">مساحة عمل {company.name}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500 sm:text-base">اختر الوحدة المالية من القائمة الجانبية. صلاحيات كل شاشة وإجراء تُفرض من طبقة الوصول الخاصة بالشركة الحالية.</p>
    </div>
    <div className="mt-7 grid gap-4 sm:grid-cols-2">
      <Stat title="الشركة الحالية" value={company.name}/>
      <Stat title="الدور" value={company.role_key === "company_admin" ? "مدير النظام" : roles[company.role_key] ?? company.role_key}/>
    </div>
  </section>;
}

function Stat({ title, value }: { title: string; value: string }) {
  return <div className="border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-slate-400">{title}</p><p className="mt-2 truncate text-lg font-bold text-slate-950">{value}</p></div>;
}
