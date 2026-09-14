"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import WorkspaceSidebar from "@/components/workspace/workspace-sidebar";

type Company = { id: string; name: string; legal_name: string | null; role: string; role_key: string; };

const routePermissions: Array<[string, string, string]> = [
  ["/workspace/executive-dashboard", "screen.executive_dashboard.view", "لوحة المؤشرات"], ["/workspace/actuals", "screen.actuals.view", "البيانات الفعلية"], ["/workspace/group-reporting", "screen.group_reporting.view", "تقارير المجموعة"], ["/workspace/data-monitoring/connectors", "screen.connector_management.view", "ربط الأنظمة والمصادر"], ["/workspace/integrations", "screen.connector_management.view", "التكاملات"], ["/workspace/data-monitoring", "screen.data_monitoring.view", "مراقبة مصادر البيانات"], ["/workspace/data/master-data", "screen.master_data_import.view", "البيانات المرجعية"], ["/workspace/data/history", "screen.data_history.view", "سجل البيانات"], ["/workspace/data/accounts", "screen.accounts.view", "دليل الحسابات"], ["/workspace/data/import", "screen.data.view", "رفع البيانات"], ["/workspace/data/manual", "screen.data.view", "الإدخال اليدوي"], ["/workspace/data", "screen.data.view", "مركز البيانات"], ["/workspace/trial-balance", "screen.trial_balance.view", "ميزان المراجعة"], ["/workspace/financial-statements", "screen.financial_statements.view", "القوائم المالية"], ["/workspace/financial-analysis", "screen.financial_analysis.view", "التحليل المالي"], ["/workspace/budget", "screen.budget.view", "الميزانية"], ["/workspace/forecast", "screen.forecast.view", "التوقعات"], ["/workspace/variance", "screen.variance.view", "الفروقات"], ["/workspace/cash", "screen.cash.view", "التدفق النقدي"], ["/workspace/scenarios", "screen.scenarios.view", "السيناريوهات"], ["/workspace/dimensions", "screen.dimensions.view", "الأبعاد"], ["/workspace/reports", "screen.reports.view", "التقارير"], ["/workspace/ai-analyst", "screen.ai_analyst.view", "المحلل المالي الذكي"], ["/workspace/team", "screen.team.view", "الفريق والصلاحيات"], ["/workspace/audit", "screen.audit.view", "سجل العمليات"], ["/workspace/company-profile", "screen.company_profile.view", "ملف الشركة"]
];
function permissionForPath(pathname: string) { return routePermissions.find(([path]) => pathname === path || pathname.startsWith(`${path}/`)); }
function AccessDenied({ name }: { name: string }) { const router = useRouter(); return <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center justify-center px-4 py-10 sm:px-6" dir="rtl"><div className="w-full border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10"><p className="text-xs font-bold tracking-[0.16em] text-slate-400">FP&A ACCESS CONTROL</p><h1 className="mt-4 text-2xl font-bold text-slate-950 sm:text-3xl">ليس لديك صلاحية الدخول إلى {name}</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-slate-500 sm:text-base">ليس لديك الصلاحية المطلوبة لاستخدام هذه الشاشة. تواصل مع مدير النظام لفتح الصلاحية لك.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={() => router.push("/workspace")} className="bg-slate-950 px-6 py-3.5 text-sm font-bold text-white hover:bg-slate-800">العودة إلى مساحة العمل</button><button type="button" onClick={() => router.push("/start")} className="border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50">شركاتي</button></div></div></section>; }

function WorkspaceContextBar() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; avatar: string }>({ name: "المستخدم", email: "", avatar: "" });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeId, setActiveId] = useState("");
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const supabase = getSupabaseBrowserClient();
    async function load() {
      const [{ data: auth }, { data: workspaces }] = await Promise.all([supabase.auth.getUser(), supabase.rpc("get_my_workspaces")]);
      if (!alive) return;
      if (auth.user) {
        const metadata = auth.user.user_metadata ?? {};
        setUser({ name: metadata.full_name || metadata.name || auth.user.email?.split("@")[0] || "المستخدم", email: auth.user.email || "", avatar: metadata.avatar_url || metadata.picture || "" });
      }
      setCompanies((workspaces ?? []) as Company[]);
      setActiveId(window.sessionStorage.getItem("activeOrganizationId") || "");
    }
    void load();
    return () => { alive = false; };
  }, []);

  const activeCompany = companies.find((company) => company.id === activeId) || companies[0];

  async function switchCompany(company: Company) {
    window.sessionStorage.setItem("activeOrganizationId", company.id);
    setActiveId(company.id);
    setOpen(false);
    router.push("/workspace");
  }

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
  }

  return <header className="sticky top-0 z-40 border-b border-slate-200 bg-white" dir="rtl">
    <div className="mx-auto flex min-h-[72px] w-full max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="relative">
          <button type="button" onClick={() => { setProfileOpen((v) => !v); setOpen(false); }} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-right hover:bg-slate-50" aria-expanded={profileOpen}>
            {user.avatar ? <img src={user.avatar} alt="" className="h-9 w-9 rounded-full object-cover border border-slate-200" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{user.name.slice(0, 1).toUpperCase()}</span>}
            <span className="hidden min-w-0 sm:block"><span className="block max-w-[180px] truncate text-sm font-bold text-slate-900">{user.name}</span><span className="block max-w-[220px] truncate text-[11px] text-slate-400">{user.email}</span></span>
            <span className="text-xs text-slate-400">⌄</span>
          </button>
          {profileOpen && <div className="absolute right-0 top-full mt-2 w-64 border border-slate-200 bg-white p-2 shadow-lg">
            <div className="border-b border-slate-100 px-3 py-3"><p className="text-sm font-bold text-slate-900">{user.name}</p><p className="mt-1 break-all text-xs text-slate-500">{user.email}</p></div>
            <button type="button" onClick={() => router.push("/workspace/company-profile")} className="mt-1 w-full px-3 py-2.5 text-right text-sm font-semibold text-slate-700 hover:bg-slate-50">ملف الشركة</button>
            <button type="button" onClick={() => router.push("/start")} className="w-full px-3 py-2.5 text-right text-sm font-semibold text-slate-700 hover:bg-slate-50">إدارة الشركات</button>
            <button type="button" onClick={() => void signOut()} className="w-full px-3 py-2.5 text-right text-sm font-semibold text-red-600 hover:bg-red-50">تسجيل الخروج</button>
          </div>}
        </div>

        <div className="relative border-r border-slate-200 pr-3">
          <button type="button" onClick={() => { setOpen((v) => !v); setProfileOpen(false); }} className="flex min-w-[190px] items-center justify-between gap-4 rounded-lg px-3 py-2 text-right hover:bg-slate-50" aria-expanded={open}>
            <span className="min-w-0"><span className="block text-[10px] font-bold text-slate-400">الشركة الحالية</span><span className="mt-0.5 block max-w-[170px] truncate text-sm font-bold text-slate-900">{activeCompany?.name || "اختر الشركة"}</span></span><span className="text-xs text-slate-400">⌄</span>
          </button>
          {open && <div className="absolute right-0 top-full mt-2 w-72 border border-slate-200 bg-white p-2 shadow-lg">
            <p className="px-3 py-2 text-[10px] font-bold tracking-wide text-slate-400">شركاتك</p>
            {companies.length ? companies.map((company) => <button key={company.id} type="button" onClick={() => void switchCompany(company)} className={`flex w-full items-center justify-between px-3 py-3 text-right hover:bg-slate-50 ${company.id === activeId ? "bg-slate-50" : ""}`}><span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-900">{company.name}</span><span className="mt-0.5 block text-[11px] text-slate-400">{company.role}</span></span>{company.id === activeId && <span className="text-sm font-bold text-slate-900">✓</span>}</button>) : <p className="px-3 py-4 text-sm text-slate-500">لا توجد شركات مرتبطة بالحساب</p>}
            <button type="button" onClick={() => router.push("/start")} className="mt-1 w-full border-t border-slate-100 px-3 py-3 text-right text-sm font-bold text-slate-700 hover:bg-slate-50">إدارة الشركات ←</button>
          </div>}
        </div>
      </div>
      <div className="hidden text-left sm:block"><p className="text-[10px] font-bold tracking-[0.16em] text-slate-400">FP&A WORKSPACE</p><p className="mt-1 text-xs font-semibold text-slate-500">مساحة العمل المالية</p></div>
    </div>
  </header>;
}

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter(); const pathname = usePathname(); const [status, setStatus] = useState<"loading" | "authenticated" | "denied">("loading"); const [deniedName, setDeniedName] = useState("هذه الشاشة"); const required = useMemo(() => permissionForPath(pathname || "/workspace"), [pathname]);
  useEffect(() => { if (pathname === "/workspace/access-denied") { setStatus("authenticated"); return; } const supabase = getSupabaseBrowserClient(); let active = true; async function authorize() { const { data } = await supabase.auth.getUser(); if (!data.user) { router.replace(`/login?next=${encodeURIComponent(pathname || "/workspace")}`); return; } const organizationId = window.sessionStorage.getItem("activeOrganizationId"); if (!organizationId) { router.replace("/start"); return; } if (!required || pathname === "/workspace") { if (active) setStatus("authenticated"); return; } const { data: access, error } = await supabase.rpc("get_my_org_access", { p_organization_id: organizationId }); if (error) { if (active) { setDeniedName(required[2]); setStatus("denied"); } return; } const allowed = (access ?? []).some((item: { permission_key?: string; granted?: boolean }) => item.permission_key === required[1] && item.granted === true); if (!allowed) { if (active) { setDeniedName(required[2]); setStatus("denied"); } return; } if (active) setStatus("authenticated"); } void authorize(); const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (!active) return; if (!session?.user) router.replace(`/login?next=${encodeURIComponent(pathname || "/workspace")}`); }); return () => { active = false; listener.subscription.unsubscribe(); }; }, [pathname, required, router]);
  if (status === "loading") return <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl"><div className="flex min-h-screen items-center justify-center px-4"><p className="text-sm text-slate-500">جارٍ التحقق من الوصول…</p></div></main>;
  return <main className="min-h-screen bg-[#f7f8fa] text-slate-900" dir="rtl"><WorkspaceContextBar/><div className="mx-auto grid min-h-[calc(100vh-72px)] w-full max-w-[1500px] items-start lg:grid-cols-[250px_minmax(0,1fr)]"><WorkspaceSidebar/><section className="min-w-0 lg:col-start-2 lg:row-start-1">{status === "denied" ? <AccessDenied name={deniedName}/> : children}</section></div></main>;
}
