"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const modules = [
  { title: "البيانات الفعلية", text: "إضافة واستيراد البيانات بعد التحقق والمطابقة.", href: "/workspace/data" },
  { title: "الميزانية", text: "بناء خطة مالية شهرية وسنوية قابلة للمقارنة.", href: "/workspace/budget" },
  { title: "التوقعات", text: "تحديث الرؤية المستقبلية اعتمادًا على الأداء الفعلي.", href: "/workspace/forecast" },
  { title: "الفروقات", text: "مقارنة الفعلي بالموازنة والتوقع وتحديد أسباب الانحراف.", href: "/workspace/variance" },
  { title: "التدفق النقدي", text: "متابعة السيولة والتدفقات المتوقعة.", href: "/workspace/cash" },
  { title: "السيناريوهات", text: "اختبار أثر القرارات والافتراضات قبل اعتمادها.", href: "/workspace/scenarios" },
];

const navigation = [
  ["overview", "نظرة عامة"], ["actuals", "البيانات الفعلية"], ["budget", "الميزانية"], ["forecast", "التوقعات"],
  ["variance", "الفروقات"], ["cash", "التدفق النقدي"], ["scenarios", "السيناريوهات"], ["data", "البيانات والاستيراد"],
] as const;

const roleLabels: Record<string, string> = {
  company_admin: "مسؤول الشركة", ceo: "الرئيس التنفيذي", cfo: "المدير المالي", finance_manager: "مدير مالي",
  fpa_analyst: "محلل FP&A", accountant: "محاسب", department_manager: "مدير قسم", sales_manager: "مدير مبيعات",
  hr_manager: "مدير الموارد البشرية", procurement_manager: "مدير المشتريات", operations_manager: "مدير العمليات",
  viewer: "مطلع", admin: "مسؤول الشركة", planner: "محلل FP&A",
};

type Company = { id: string; name: string; base_currency: string; role: string; role_key: string };
type AuthState = "loading" | "authenticated" | "unauthenticated";

export default function WorkspacePage() {
  const router = useRouter();
  const [active, setActive] = useState("overview");
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let activeEffect = true;

    async function loadWorkspace() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (activeEffect) setAuthState("unauthenticated");
        router.replace("/login?next=/workspace");
        return;
      }

      const { data, error } = await supabase.rpc("get_my_workspaces");
      if (error) {
        if (activeEffect) router.replace("/start");
        return;
      }

      const list = (data ?? []) as Company[];
      if (!list.length) {
        router.replace("/start");
        return;
      }

      const activeId = window.sessionStorage.getItem("activeOrganizationId");
      if (list.length > 1 && (!activeId || !list.some((item) => item.id === activeId))) {
        router.replace("/start");
        return;
      }

      const selected = list.find((item) => item.id === activeId) ?? list[0];
      if (!activeEffect) return;
      window.sessionStorage.setItem("activeOrganizationId", selected.id);
      setCompany(selected);
      setCompanies(list);
      setAuthState("authenticated");
    }

    void loadWorkspace();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!activeEffect) return;
      if (!session?.user) {
        setAuthState("unauthenticated");
        router.replace("/login?next=/workspace");
      }
    });
    return () => { activeEffect = false; listener.subscription.unsubscribe(); };
  }, [router]);

  const companyOptions = useMemo(() => companies.length > 1, [companies.length]);
  function switchCompany(id: string) {
    const next = companies.find((item) => item.id === id);
    if (!next) return;
    window.sessionStorage.setItem("activeOrganizationId", next.id);
    setCompany(next);
    setActive("overview");
  }

  if (authState !== "authenticated" || !company) {
    return <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl"><div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10 sm:px-6"><div className="w-full rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10"><p className="text-xs font-bold tracking-[0.16em] text-slate-400">FP&A WORKSPACE</p><p className="mt-4 text-base font-semibold text-slate-800">جارٍ تجهيز مساحة العمل…</p></div></div></main>;
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">{company.name.slice(0, 1)}</div><div className="min-w-0"><p className="text-[11px] font-bold tracking-[0.14em] text-slate-400">FP&A WORKSPACE</p>{companyOptions ? <select aria-label="اختيار الشركة" value={company.id} onChange={(event) => switchCompany(event.target.value)} className="mt-0.5 max-w-[18rem] bg-transparent text-base font-bold text-slate-950 outline-none sm:text-lg">{companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : <h1 className="mt-0.5 truncate text-base font-bold text-slate-950 sm:text-lg">{company.name}</h1>}</div></div><div className="flex items-center gap-2 sm:gap-3"><span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 sm:px-4 sm:text-sm">{roleLabels[company.role_key] ?? company.role_key}</span><Link href="/start" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:px-4 sm:text-sm">تبديل الشركة</Link></div></div></header>
      <div className="mx-auto w-full max-w-[1500px] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]"><aside className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-l lg:p-5"><nav className="flex gap-2 overflow-x-auto px-4 py-3 lg:block lg:space-y-1 lg:px-0 lg:py-0" aria-label="التنقل الرئيسي">{navigation.map(([id, label]) => <button key={id} type="button" onClick={() => setActive(id)} className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-right text-sm font-semibold transition lg:w-full ${active === id ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>{label}</button>)}<Link href="/workspace/team" className="mt-1 block shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-right text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-950 lg:w-full">الفريق والصلاحيات</Link></nav><div className="hidden border-t border-slate-100 pt-6 lg:mt-10 lg:block"><p className="text-xs leading-6 text-slate-400">الصلاحيات مرتبطة بالشركة والنطاق. يمكن أن يعمل فريق كامل داخل نفس الشركة دون إعطاء الجميع صلاحية تعديل أو اعتماد كل شيء.</p></div></aside>
        <section className="min-w-0 p-4 sm:p-6 lg:p-10">{active === "overview" ? <><div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-7 sm:pb-8 md:flex-row md:items-end"><div><p className="text-xs font-bold tracking-[0.14em] text-slate-400">OVERVIEW</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">مرحبًا بك في مساحة {company.name}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base sm:leading-8">هذه هي نقطة العمل اليومية. لا نعيدك إلى إعداد الشركة عند كل دخول؛ تدخل مباشرة إلى بيانات الشركة وفق دورك وصلاحياتك.</p></div><Link href="/workspace/team" className="inline-flex w-full shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-bold text-slate-900 hover:bg-slate-50 sm:w-auto">إدارة الفريق والصلاحيات</Link></div><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{modules.map((module) => <Link href={module.href} key={module.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:shadow-md sm:p-6"><h3 className="font-bold text-slate-950">{module.title}</h3><p className="mt-3 text-sm leading-7 text-slate-500">{module.text}</p><span className="mt-5 inline-block text-xs font-bold text-slate-400">فتح الوحدة ←</span></Link>)}</div></> : active === "actuals" ? <ModuleState title="البيانات الفعلية" eyebrow="ACTUALS" text="النموذج المالي الفعلي يعرض فقط البيانات التي اجتازت التحقق والمطابقة وتم نشرها بنجاح." href="/workspace/actuals" action="فتح البيانات الفعلية" /> : active === "data" ? <ModuleState title="البيانات والاستيراد" eyebrow="DATA IMPORT" text="رفع Excel أو CSV والتحقق من بنية القيود قبل الانتقال إلى المطابقة. هذا هو مركز الاستيراد، وليس خطوة من نموذج تعريف المؤسسة." href="/workspace/data" action="فتح مركز الاستيراد" /> : <ModuleState title="هذه الوحدة قيد البناء" eyebrow={active.toUpperCase()} text="سيتم بناء هذه الوحدة بعد تثبيت البيانات الفعلية والتحقق منها، وفق ترتيب التنفيذ المحدد في وثائق المشروع." />}</section>
      </div>
    </main>
  );
}

function ModuleState({ title, eyebrow, text, href, action }: { title: string; eyebrow: string; text: string; href?: string; action?: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-12"><p className="text-xs font-bold tracking-[0.14em] text-slate-400">{eyebrow}</p><h2 className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base sm:leading-8">{text}</p>{href && action && <Link href={href} className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-bold text-white sm:w-auto">{action}</Link>}</div>; }
