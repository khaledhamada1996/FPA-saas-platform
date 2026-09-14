"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import WorkspaceSidebar from "@/components/workspace/workspace-sidebar";

const routePermissions: Array<[string, string, string]> = [
  ["/workspace/executive-dashboard", "screen.executive_dashboard.view", "لوحة المؤشرات"],
  ["/workspace/actuals", "screen.actuals.view", "البيانات الفعلية"],
  ["/workspace/group-reporting", "screen.group_reporting.view", "تقارير المجموعة"],
  ["/workspace/data-monitoring/connectors", "screen.connector_management.view", "ربط الأنظمة والمصادر"],
  ["/workspace/integrations", "screen.connector_management.view", "التكاملات"],
  ["/workspace/data-monitoring", "screen.data_monitoring.view", "مراقبة مصادر البيانات"],
  ["/workspace/data/master-data", "screen.master_data_import.view", "البيانات المرجعية"],
  ["/workspace/data/history", "screen.data_history.view", "سجل البيانات"],
  ["/workspace/data/accounts", "screen.accounts.view", "دليل الحسابات"],
  ["/workspace/data/import", "screen.data.view", "رفع البيانات"],
  ["/workspace/data/manual", "screen.data.view", "الإدخال اليدوي"],
  ["/workspace/data", "screen.data.view", "مركز البيانات"],
  ["/workspace/trial-balance", "screen.trial_balance.view", "ميزان المراجعة"],
  ["/workspace/financial-statements", "screen.financial_statements.view", "القوائم المالية"],
  ["/workspace/financial-analysis", "screen.financial_analysis.view", "التحليل المالي"],
  ["/workspace/budget", "screen.budget.view", "الميزانية"],
  ["/workspace/forecast", "screen.forecast.view", "التوقعات"],
  ["/workspace/variance", "screen.variance.view", "الفروقات"],
  ["/workspace/cash", "screen.cash.view", "التدفق النقدي"],
  ["/workspace/scenarios", "screen.scenarios.view", "السيناريوهات"],
  ["/workspace/dimensions", "screen.dimensions.view", "الأبعاد"],
  ["/workspace/reports", "screen.reports.view", "التقارير"],
  ["/workspace/ai-analyst", "screen.ai_analyst.view", "المحلل المالي الذكي"],
  ["/workspace/team", "screen.team.view", "الفريق والصلاحيات"],
  ["/workspace/audit", "screen.audit.view", "سجل العمليات"],
  ["/workspace/company-profile", "screen.company_profile.view", "ملف الشركة"],
];

function permissionForPath(pathname: string) {
  return routePermissions.find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
}

function AccessDenied({ name }: { name: string }) {
  const router = useRouter();
  return <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center justify-center px-4 py-10 sm:px-6" dir="rtl"><div className="w-full border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10"><p className="text-xs font-bold tracking-[0.16em] text-slate-400">FP&A ACCESS CONTROL</p><h1 className="mt-4 text-2xl font-bold text-slate-950 sm:text-3xl">ليس لديك صلاحية الدخول إلى {name}</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-slate-500 sm:text-base">ليس لديك الصلاحية المطلوبة لاستخدام هذه الشاشة. تواصل مع مدير النظام لفتح الصلاحية لك.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={() => router.push("/workspace")} className="bg-slate-950 px-6 py-3.5 text-sm font-bold text-white hover:bg-slate-800">العودة إلى مساحة العمل</button><button type="button" onClick={() => router.push("/start")} className="border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50">شركاتي</button></div></div></section>;
}

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"loading" | "authenticated" | "denied">("loading");
  const [deniedName, setDeniedName] = useState("هذه الشاشة");
  const required = useMemo(() => permissionForPath(pathname || "/workspace"), [pathname]);

  useEffect(() => {
    if (pathname === "/workspace/access-denied") { setStatus("authenticated"); return; }
    const supabase = getSupabaseBrowserClient();
    let active = true;
    async function authorize() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.replace(`/login?next=${encodeURIComponent(pathname || "/workspace")}`); return; }
      const organizationId = window.sessionStorage.getItem("activeOrganizationId");
      if (!organizationId) { router.replace("/start"); return; }
      if (!required || pathname === "/workspace") { if (active) setStatus("authenticated"); return; }
      const { data: access, error } = await supabase.rpc("get_my_org_access", { p_organization_id: organizationId });
      if (error) { if (active) { setDeniedName(required[2]); setStatus("denied"); } return; }
      const allowed = (access ?? []).some((item: { permission_key?: string; granted?: boolean }) => item.permission_key === required[1] && item.granted === true);
      if (!allowed) { if (active) { setDeniedName(required[2]); setStatus("denied"); } return; }
      if (active) setStatus("authenticated");
    }
    void authorize();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (!active) return; if (!session?.user) router.replace(`/login?next=${encodeURIComponent(pathname || "/workspace")}`); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [pathname, required, router]);

  if (status !== "authenticated") return <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl"><div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4"><p className="text-sm text-slate-500">{status === "denied" ? "جارٍ تجهيز شاشة الوصول…" : "جارٍ التحقق من الوصول…"}</p></div></main>;

  return <main className="min-h-screen bg-[#f7f8fa] text-slate-900" dir="rtl"><div className="mx-auto grid min-h-screen w-full max-w-[1500px] items-start lg:grid-cols-[250px_minmax(0,1fr)]"><WorkspaceSidebar /><section className="min-w-0 lg:col-start-2 lg:row-start-1">{status === "denied" ? <AccessDenied name={deniedName} /> : children}</section></div></main>;
}
