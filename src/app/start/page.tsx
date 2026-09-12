"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  legal_name: string | null;
  industry: string | null;
  city: string | null;
  base_currency: string;
  role: string;
  role_key: string;
};

const roleLabels: Record<string, string> = {
  owner: "مالك",
  admin: "مسؤول الشركة",
  company_admin: "مسؤول الشركة",
  finance_manager: "مدير مالي",
  cfo: "المدير المالي",
  accountant: "محاسب",
  fpa_analyst: "محلل FP&A",
  viewer: "مطلع",
};

export default function StartPage() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "empty" | "companies">("loading");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    async function loadCompanies() {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        router.replace("/login?next=/start");
        return;
      }

      const { data, error: workspaceError } = await supabase.rpc("get_my_workspaces");

      if (workspaceError) {
        if (active) {
          setError("تعذر تحميل الشركات المرتبطة بحسابك.");
          setState("empty");
        }
        return;
      }

      const nextCompanies = (data ?? []) as Company[];
      if (!active) return;

      if (nextCompanies.length === 0) {
        setState("empty");
        return;
      }

      if (nextCompanies.length === 1) {
        window.sessionStorage.setItem("activeOrganizationId", nextCompanies[0].id);
        router.replace("/workspace");
        return;
      }

      setCompanies(nextCompanies);
      setState("companies");
    }

    void loadCompanies();
    return () => {
      active = false;
    };
  }, [router]);

  function enterCompany(company: Company) {
    window.sessionStorage.setItem("activeOrganizationId", company.id);
    router.push("/workspace");
  }

  if (state === "loading") {
    return <CenteredState text="جارٍ تحميل مساحة العمل…" />;
  }

  if (state === "empty") {
    return (
      <main className="min-h-screen bg-[#f7f8fa] px-4 py-8 text-[#172033] sm:px-6" dir="rtl">
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center justify-center">
          <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-slate-400">WELCOME TO FP&A</p>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">لننشئ أول شركة لك</h1>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">لن نطلب منك معلومات الشركة في كل تسجيل دخول. هذه الشاشة تظهر فقط عندما لا توجد شركة مرتبطة بحسابك.</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">لا توجد شركات</span>
            </div>
            {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <button type="button" onClick={() => router.push("/start/new")} className="mt-8 w-full rounded-xl bg-slate-950 px-6 py-4 text-sm font-bold text-white transition hover:bg-slate-800 sm:w-auto">إضافة شركة</button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-6 text-[#172033] sm:px-6 lg:px-10" dir="rtl">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="min-w-0"><p className="text-xs font-bold tracking-[0.16em] text-slate-400">FP&A</p><h1 className="mt-1 truncate text-lg font-bold text-slate-950">شركاتي</h1></div>
        <button type="button" onClick={() => router.push("/start/new")} className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:px-5">+ إضافة شركة</button>
      </header>
      <section className="mx-auto w-full max-w-7xl py-8 sm:py-10 lg:py-14">
        <div className="max-w-3xl"><p className="text-xs font-bold tracking-[0.14em] text-slate-400">YOUR WORKSPACES</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">اختر الشركة التي تريد العمل عليها</h2><p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base">تظهر لك فقط الشركات التي لديك صلاحية الوصول إليها. عند اختيار شركة نفتح مساحة العمل مباشرة حسب صلاحياتك.</p></div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => (
            <button key={company.id} type="button" onClick={() => enterCompany(company)} className="group rounded-3xl border border-slate-200 bg-white p-6 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md">
              <div className="flex items-start justify-between gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-lg font-bold text-white">{company.name.slice(0, 1)}</div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{roleLabels[company.role_key] ?? roleLabels[company.role] ?? company.role_key}</span></div>
              <h3 className="mt-6 text-xl font-bold text-slate-950">{company.name}</h3>
              <p className="mt-2 min-h-6 text-sm text-slate-500">{company.industry || "قطاع غير محدد"}{company.city ? ` · ${company.city}` : ""}</p>
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400"><span>{company.base_currency}</span><span className="font-bold text-slate-700 group-hover:text-slate-950">دخول إلى الشركة ←</span></div>
            </button>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-500 sm:p-6"><span className="font-bold text-slate-900">فكرة المساحة:</span> نفس الشركة يمكن أن يعمل عليها فريق كامل، لكن كل مستخدم يرى وينفذ فقط ما تسمح به صلاحياته. إدارة الفريق والصلاحيات جزء أساسي من مساحة العمل.</div>
      </section>
    </main>
  );
}

function CenteredState({ text }: { text: string }) {
  return <main className="min-h-screen bg-[#f7f8fa] px-4 py-8 text-[#172033]" dir="rtl"><div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl items-center justify-center"><div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-semibold text-slate-600">{text}</p></div></div></main>;
}
