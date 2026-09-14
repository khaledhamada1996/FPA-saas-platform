"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Company = { id: string; name: string; base_currency: string; role: string; role_key: string };
type AccessRow = { permission_key?: string; granted?: boolean; screen_key?: string | null; route_path?: string | null; name?: string | null };
type AuthState = "loading" | "authenticated" | "unauthenticated";

const roleLabels: Record<string, string> = {
  company_admin: "مدير النظام",
  admin: "مدير النظام",
  owner: "المالك",
  ceo: "الرئيس التنفيذي",
  cfo: "المدير المالي",
  finance_manager: "مدير مالي",
  fpa_analyst: "محلل FP&A",
  accountant: "محاسب",
  department_manager: "مدير قسم",
  sales_manager: "مدير مبيعات",
  hr_manager: "مدير الموارد البشرية",
  procurement_manager: "مدير المشتريات",
  operations_manager: "مدير العمليات",
  viewer: "مطلع",
  executive_director: "مدير تنفيذي",
  planner: "محلل FP&A",
};

const modules = [
  ["screen.budget.view", "الميزانية", "", "/workspace/budget"],
  ["screen.forecast.view", "التوقعات", "", "/workspace/forecast"],
  ["screen.variance.view", "الفروقات", "", "/workspace/variance"],
  ["screen.cash.view", "التدفق النقدي", "", "/workspace/cash"],
  ["screen.scenarios.view", "السيناريوهات", "", "/workspace/scenarios"],
  ["screen.financial_analysis.view", "التحليل المالي", "", "/workspace/financial-analysis"],
  ["screen.financial_statements.view", "القوائم المالية", "", "/workspace/financial-statements"],
  ["screen.ai_analyst.view", "المحلل المالي الذكي", "", "/workspace/ai-analyst"],
] as const;

const navigation = [
  ["screen.executive_dashboard.view", "لوحة المؤشرات", "/workspace/executive-dashboard"],
  ["screen.data_monitoring.view", "مراقبة مصادر البيانات", "/workspace/data-monitoring"],
  ["screen.group_reporting.view", "تقارير المجموعة", "/workspace/group-reporting"],
  ["screen.trial_balance.view", "ميزان المراجعة", "/workspace/trial-balance"],
  ["screen.financial_statements.view", "القوائم المالية", "/workspace/financial-statements"],
  ["screen.financial_analysis.view", "التحليل المالي", "/workspace/financial-analysis"],
  ["screen.budget.view", "الميزانية", "/workspace/budget"],
  ["screen.forecast.view", "التوقعات", "/workspace/forecast"],
  ["screen.variance.view", "الفروقات", "/workspace/variance"],
  ["screen.cash.view", "التدفق النقدي", "/workspace/cash"],
  ["screen.scenarios.view", "السيناريوهات", "/workspace/scenarios"],
  ["screen.dimensions.view", "الأبعاد", "/workspace/dimensions"],
  ["screen.reports.view", "التقارير", "/workspace/reports"],
  ["screen.ai_analyst.view", "المحلل المالي الذكي", "/workspace/ai-analyst"],
  ["screen.team.view", "الفريق والصلاحيات", "/workspace/team"],
  ["screen.audit.view", "سجل العمليات", "/workspace/audit"],
  ["screen.company_profile.view", "ملف الشركة", "/workspace/company-profile"],
] as const;

const dataChildren = [
  ["screen.group_mapping.view", "ربط حسابات المجموعة", "/workspace/group-reporting/mapping"],
  ["screen.data.view", "البيانات", "/workspace/data"],
  ["screen.data_history.view", "سجل البيانات", "/workspace/data/history"],
] as const;

export default function WorkspacePage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [access, setAccess] = useState<AccessRow[]>([]);
  const [isDataOpen, setIsDataOpen] = useState(false);
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let alive = true;

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login?next=/workspace");
        return;
      }

      const { data, error } = await supabase.rpc("get_my_workspaces");
      if (error || !data?.length) {
        router.replace("/start");
        return;
      }

      const list = data as Company[];
      const activeId = window.sessionStorage.getItem("activeOrganizationId");
      const selectedRaw = window.sessionStorage.getItem("selectedOrganizationIds");
      let selectedIds: string[] = [];
      try {
        const parsed = selectedRaw ? JSON.parse(selectedRaw) : [];
        if (Array.isArray(parsed)) selectedIds = parsed.filter((id): id is string => typeof id === "string");
      } catch {
        selectedIds = [];
      }

      const validSelected = selectedIds.filter((id) => list.some((item) => item.id === id));
      if (list.length > 1 && (!activeId || !list.some((item) => item.id === activeId))) {
        router.replace("/start");
        return;
      }

      const selected = list.find((item) => item.id === activeId) ?? list[0];
      const { data: accessRows, error: accessError } = await supabase.rpc("get_my_org_access", { p_organization_id: selected.id });
      if (accessError) {
        router.replace("/workspace/access-denied?reason=access-check");
        return;
      }

      if (alive) {
        const initialSelection = validSelected.length ? validSelected : [selected.id];
        window.sessionStorage.setItem("activeOrganizationId", selected.id);
        window.sessionStorage.setItem("selectedOrganizationIds", JSON.stringify(initialSelection));
        setCompany(selected);
        setCompanies(list);
        setSelectedCompanyIds(initialSelection);
        setAccess((accessRows ?? []) as AccessRow[]);
        setAuthState("authenticated");
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [router]);

  const allowed = useMemo(() => new Set(access.filter((item) => item.granted === true).map((item) => item.permission_key)), [access]);
  const visibleNavigation = useMemo(() => navigation.filter(([permission]) => allowed.has(permission)), [allowed]);
  const visibleDataChildren = useMemo(() => dataChildren.filter(([permission]) => allowed.has(permission)), [allowed]);
  const visibleModules = useMemo(() => modules.filter(([permission]) => allowed.has(permission)), [allowed]);
  const canManageUsers = allowed.has("manage_users") || company?.role_key === "company_admin";
  const isSystemAdmin = company?.role_key === "company_admin" || company?.role_key === "admin";

  function applyCompanySelection() {
    if (!selectedCompanyIds.length) return;
    const nextActiveId = selectedCompanyIds.includes(company?.id ?? "") ? company!.id : selectedCompanyIds[0];
    window.sessionStorage.setItem("activeOrganizationId", nextActiveId);
    window.sessionStorage.setItem("selectedOrganizationIds", JSON.stringify(selectedCompanyIds));
    setIsCompanyOpen(false);
    window.location.assign("/workspace");
  }

  function selectOnlyCompany(id: string) {
    if (!companies.some((item) => item.id === id)) return;
    window.sessionStorage.setItem("activeOrganizationId", id);
    window.sessionStorage.setItem("selectedOrganizationIds", JSON.stringify([id]));
    setIsCompanyOpen(false);
    window.location.assign("/workspace");
  }

  function toggleCompany(id: string) {
    setSelectedCompanyIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  useEffect(() => {
    if (visibleDataChildren.length === 0) setIsDataOpen(false);
  }, [visibleDataChildren.length]);

  if (authState !== "authenticated" || !company) {
    return <main className="min-h-screen bg-[#f7f8fa] text-slate-900" dir="rtl"><div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4"><p className="text-sm text-slate-500">جارٍ التحقق…</p></div></main>;
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-slate-900" dir="rtl">
      <header className="sticky top-0 z-40 h-16 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-full w-full max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="relative min-w-0">
            <button type="button" onClick={() => setIsCompanyOpen((value) => !value)} aria-expanded={isCompanyOpen} aria-haspopup="listbox" className="flex min-w-0 items-center gap-3 text-right hover:bg-slate-50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-slate-950 text-sm font-bold text-white">{company.name.slice(0, 1)}</div>
              <div className="min-w-0">
                <p className="max-w-[15rem] truncate text-sm font-bold text-slate-950 sm:max-w-[22rem]">{company.name}</p>
                <p className="text-[11px] text-slate-400">الشركات ▾</p>
              </div>
            </button>

            {isCompanyOpen && (
              <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] border border-slate-200 bg-white p-3 shadow-xl" role="listbox" aria-label="اختيار الشركات">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div><p className="text-sm font-bold text-slate-950">الشركات</p><p className="mt-0.5 text-xs text-slate-400">اختر شركة للعمل عليها أو عدة شركات للتقارير المجمعة</p></div>
                  <button type="button" onClick={() => router.push("/start/new")} className="text-xs font-bold text-slate-700 hover:text-slate-950">+ شركة</button>
                </div>
                <div className="mt-2 max-h-72 overflow-y-auto">
                  {companies.map((item) => {
                    const checked = selectedCompanyIds.includes(item.id);
                    const active = company.id === item.id;
                    return (
                      <div key={item.id} className={`flex items-center gap-2 border-b border-slate-100 py-2 last:border-b-0 ${active ? "bg-slate-50" : ""}`}>
                        <button type="button" onClick={() => selectOnlyCompany(item.id)} className="min-w-0 flex-1 px-2 py-1 text-right">
                          <span className="block truncate text-sm font-semibold text-slate-800">{item.name}</span>
                          <span className="text-[11px] text-slate-400">{active ? "الشركة الحالية" : roleLabels[item.role_key] ?? item.role_key}</span>
                        </button>
                        <input aria-label={`تحديد ${item.name}`} type="checkbox" checked={checked} onChange={() => toggleCompany(item.id)} className="h-4 w-4 shrink-0 accent-slate-900" />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-400">{selectedCompanyIds.length} محددة</span>
                  <button type="button" disabled={!selectedCompanyIds.length} onClick={applyCompanySelection} className="bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">تطبيق الشركات</button>
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:inline-flex">{isSystemAdmin ? "مدير النظام" : roleLabels[company.role_key] ?? company.role_key}</span>
            {canManageUsers && <Link href="/workspace/team" className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">الفريق</Link>}
            <button type="button" onClick={() => setIsCompanyOpen((value) => !value)} className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">تبديل</button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1500px] lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-l lg:p-4">
          <nav className="flex gap-1 overflow-x-auto px-3 py-2 lg:block lg:space-y-0.5 lg:px-0 lg:py-0" aria-label="التنقل الرئيسي">
            {allowed.has("screen.executive_dashboard.view") && <Link href="/workspace/executive-dashboard" className="shrink-0 whitespace-nowrap px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-950 lg:block lg:w-full">لوحة المؤشرات</Link>}
            {visibleDataChildren.length > 0 && <div className="shrink-0 lg:w-full"><button type="button" onClick={() => setIsDataOpen((value) => !value)} aria-expanded={isDataOpen} className="flex w-full items-center justify-between whitespace-nowrap px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-950"><span>مركز البيانات</span><span aria-hidden="true" className="text-xs">{isDataOpen ? "⌃" : "⌄"}</span></button>{isDataOpen && <div className="mr-3 border-r border-slate-200 pr-2">{visibleDataChildren.map(([permission, label, href]) => <Link key={permission} href={href} className="block whitespace-nowrap px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-950">{label}</Link>)}</div>}</div>}
            {visibleNavigation.filter(([permission]) => permission !== "screen.executive_dashboard.view").map(([permission, label, href]) => <Link key={permission} href={href} className="shrink-0 whitespace-nowrap px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-950 lg:block lg:w-full">{label}</Link>)}
          </nav>
        </aside>

        <section className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="border-b border-slate-200 pb-5"><h2 className="text-2xl font-bold tracking-tight text-slate-950">مساحة العمل</h2></div>
          {visibleModules.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visibleModules.map(([permission, title, text, href]) => <Link href={href} key={permission} className="border border-slate-200 bg-white p-5 hover:border-slate-400"><h3 className="font-bold text-slate-950">{title}</h3>{text && <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>}</Link>)}</div> : <div className="mt-5 border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">لا توجد وحدات متاحة لهذا المستخدم.</p></div>}
        </section>
      </div>
    </main>
  );
}
