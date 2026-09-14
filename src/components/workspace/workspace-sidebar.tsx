"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AccessRow = { permission_key?: string; granted?: boolean };
type NavItem = readonly [string, string, string];

const navigation: NavItem[] = [
  ["screen.executive_dashboard.view", "لوحة المؤشرات", "/workspace/executive-dashboard"],
  ["screen.data.view", "مركز البيانات المالية", "/workspace/data"],
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
  ["screen.company_profile.view", "ملف الشركة", "/workspace/company-profile"]
];

const dataItems: NavItem[] = [
  ["screen.accounts.view", "دليل الحسابات", "/workspace/data/accounts"],
  ["screen.data.view", "الاستيرادات", "/workspace/data/import"],
  ["screen.data.view", "الإدخال اليدوي", "/workspace/data/manual"],
  ["screen.actuals.view", "البيانات الفعلية", "/workspace/actuals"],
  ["screen.data_history.view", "سجل البيانات", "/workspace/data/history"],
  ["screen.connector_management.view", "ربط الأنظمة والمصادر", "/workspace/data-monitoring/connectors"]
];

function NavLink({ item, allowed, pathname, indent = false }: { item: NavItem; allowed: Set<string>; pathname: string; indent?: boolean }) {
  const enabled = allowed.has(item[0]);
  const active = pathname === item[2] || pathname.startsWith(`${item[2]}/`);
  return <Link href={item[2]} title={enabled ? item[1] : `ليس لديك صلاحية الدخول إلى ${item[1]}`} aria-current={active ? "page" : undefined} className={`flex items-center justify-between border-b border-slate-100 py-2.5 text-sm ${indent ? "pr-3 pl-2" : "px-3"} ${active ? "bg-slate-50 font-bold text-slate-950" : enabled ? "font-semibold text-slate-700 hover:bg-slate-50" : "text-slate-400 hover:bg-slate-50"}`}><span className="truncate">{item[1]}</span><span aria-hidden="true">{enabled ? "›" : "🔒"}</span></Link>;
}

export default function WorkspaceSidebar() {
  const pathname = usePathname() || "/workspace";
  const [access, setAccess] = useState<AccessRow[]>([]);
  const [dataOpen, setDataOpen] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let alive = true;
    async function load() {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const organizationId = window.sessionStorage.getItem("activeOrganizationId");
      if (!organizationId) return;
      const { data } = await supabase.rpc("get_my_org_access", { p_organization_id: organizationId });
      if (alive) setAccess((data ?? []) as AccessRow[]);
    }
    void load();
    return () => { alive = false; };
  }, [pathname]);

  const allowed = useMemo(() => new Set(access.filter((row) => row.granted === true).map((row) => row.permission_key).filter(Boolean) as string[]), [access]);
  const enabledCount = navigation.filter((item) => allowed.has(item[0])).length;
  const dataActive = pathname === "/workspace/data" || pathname.startsWith("/workspace/data/") || pathname === "/workspace/actuals";

  return <aside className="sticky top-[72px] z-30 h-[calc(100vh-72px)] min-h-0 self-start overflow-y-auto overscroll-contain border-l border-slate-200 bg-white p-3 max-lg:relative max-lg:top-0 max-lg:h-auto max-lg:border-l-0 max-lg:border-b">
    <div className="mb-3 border-b border-slate-100 px-3 pb-3"><p className="text-[10px] font-bold tracking-[.16em] text-slate-400">FP&A WORKSPACE</p><p className="mt-1 text-sm font-bold">مساحة العمل</p><p className="mt-1 text-xs text-slate-400">المتاح لك: {enabledCount} من {navigation.length}</p></div>
    <nav>
      <NavLink item={navigation[0]} allowed={allowed} pathname={pathname}/>
      <div className="border-b border-slate-100">
        <button type="button" onClick={() => setDataOpen((value) => !value)} className={`flex w-full items-center justify-between px-3 py-2.5 text-right text-sm ${dataActive ? "bg-slate-50 font-bold text-slate-950" : allowed.has("screen.data.view") ? "font-bold text-slate-700 hover:bg-slate-50" : "text-slate-400 hover:bg-slate-50"}`} aria-expanded={dataOpen}>
          <span>مركز البيانات المالية</span><span aria-hidden="true">{dataOpen ? "⌄" : "›"}</span>
        </button>
        {dataOpen && <div className="mr-3 border-r border-slate-200 pr-2">{dataItems.map((item) => <NavLink key={item[2]} item={item} allowed={allowed} pathname={pathname} indent/>)}</div>}
      </div>
      {navigation.slice(2).map((item) => <NavLink key={item[2]} item={item} allowed={allowed} pathname={pathname}/>) }
    </nav>
  </aside>;
}
