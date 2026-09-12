"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const routePermissions: Array<[string, string]> = [
  ["/workspace/executive-dashboard", "screen.executive_dashboard.view"], ["/workspace/actuals", "screen.actuals.view"],
  ["/workspace/data/history", "screen.data_history.view"], ["/workspace/data/accounts", "screen.accounts.view"], ["/workspace/data", "screen.data.view"],
  ["/workspace/trial-balance", "screen.trial_balance.view"], ["/workspace/financial-statements", "screen.financial_statements.view"],
  ["/workspace/financial-analysis", "screen.financial_analysis.view"], ["/workspace/budget", "screen.budget.view"], ["/workspace/forecast", "screen.forecast.view"],
  ["/workspace/variance", "screen.variance.view"], ["/workspace/cash", "screen.cash.view"], ["/workspace/scenarios", "screen.scenarios.view"],
  ["/workspace/dimensions", "screen.dimensions.view"], ["/workspace/reports", "screen.reports.view"], ["/workspace/ai-analyst", "screen.ai_analyst.view"],
  ["/workspace/audit", "screen.audit.view"], ["/workspace/company-profile", "screen.company_profile.view"], ["/workspace/team", "screen.team.view"],
  ["/workspace", "screen.workspace.view"],
];

function permissionForPath(pathname: string) {
  return routePermissions.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? "screen.workspace.view";
}

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"loading" | "authenticated" | "denied">("loading");

  useEffect(() => {
    if (pathname === "/workspace/access-denied") {
      setStatus("authenticated");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let active = true;
    async function authorize() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/workspace")}`);
        return;
      }
      const organizationId = window.sessionStorage.getItem("activeOrganizationId");
      if (!organizationId) {
        router.replace("/start");
        return;
      }
      const { data: access, error } = await supabase.rpc("get_my_org_access", { p_organization_id: organizationId });
      if (error) {
        if (active) setStatus("denied");
        router.replace(`/workspace/access-denied?reason=access-check`);
        return;
      }
      const requiredPermission = permissionForPath(pathname || "/workspace");
      const allowed = (access ?? []).some((item: { permission_key?: string; granted?: boolean }) => item.permission_key === requiredPermission && item.granted === true);
      if (!allowed) {
        if (active) setStatus("denied");
        router.replace(`/workspace/access-denied?permission=${encodeURIComponent(requiredPermission)}`);
        return;
      }
      if (active) setStatus("authenticated");
    }
    void authorize();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session?.user) router.replace(`/login?next=${encodeURIComponent(pathname || "/workspace")}`);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [pathname, router]);

  if (status !== "authenticated") {
    return <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl"><div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10 sm:px-6"><div className="w-full rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10"><p className="text-xs font-bold tracking-[0.16em] text-slate-400">FP&A WORKSPACE</p><p className="mt-4 text-base font-semibold text-slate-800">{status === "denied" ? "جارٍ التحقق من صلاحية الوصول…" : "جارٍ التحقق من تسجيل الدخول والصلاحيات…"}</p></div></div></main>;
  }
  return children;
}
