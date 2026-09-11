"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const planningModules = [
  { id: "budget", title: "الميزانية", text: "بناء خطة مالية شهرية وسنوية قابلة للمقارنة." },
  { id: "forecast", title: "التوقعات", text: "تحديث الرؤية المستقبلية اعتمادًا على الأداء الفعلي." },
  { id: "variance", title: "الفروقات", text: "مقارنة الفعلي بالموازنة والتوقع وتحديد أسباب الانحراف." },
  { id: "cash", title: "التدفق النقدي", text: "متابعة السيولة والتدفقات المتوقعة." },
  { id: "scenarios", title: "السيناريوهات", text: "اختبار أثر القرارات والافتراضات قبل اعتمادها." },
];

const navigation = [
  { id: "overview", label: "نظرة عامة", group: "الرئيسية" },
  { id: "actuals", label: "البيانات الفعلية", group: "البيانات" },
  { id: "data", label: "الاستيراد والتحقق", group: "البيانات" },
  { id: "budget", label: "الميزانية", group: "التخطيط" },
  { id: "forecast", label: "التوقعات", group: "التخطيط" },
  { id: "variance", label: "الفروقات", group: "التخطيط" },
  { id: "cash", label: "التدفق النقدي", group: "التخطيط" },
  { id: "scenarios", label: "السيناريوهات", group: "التخطيط" },
] as const;

const groups = ["الرئيسية", "البيانات", "التخطيط"] as const;

type AuthState = "loading" | "authenticated" | "unauthenticated";

export default function WorkspacePage() {
  const router = useRouter();
  const [active, setActive] = useState("overview");
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let activeEffect = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!activeEffect) return;
      if (data.user) setAuthState("authenticated");
      else {
        setAuthState("unauthenticated");
        router.replace("/login?next=/workspace");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!activeEffect) return;
      if (session?.user) setAuthState("authenticated");
      else {
        setAuthState("unauthenticated");
        router.replace("/login?next=/workspace");
      }
    });

    return () => {
      activeEffect = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  if (authState !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-4 text-[#172033]" dir="rtl">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-9">
          <p className="text-xs font-bold tracking-[0.16em] text-slate-400">FP&A WORKSPACE</p>
          <p className="mt-4 text-sm font-semibold text-slate-800 sm:text-base">جارٍ التحقق من تسجيل الدخول…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.16em] text-slate-400 sm:text-xs">FP&A WORKSPACE</p>
            <h1 className="mt-0.5 truncate text-base font-bold text-slate-950 sm:text-lg">مساحة العمل المالي</h1>
          </div>
          <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:px-4 sm:py-2 sm:text-sm">شركة جديدة</div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1500px] lg:grid-cols-[236px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:overflow-y-auto lg:border-b-0 lg:border-l">
          <nav className="flex gap-2 overflow-x-auto px-4 py-3 lg:block lg:space-y-5 lg:px-4 lg:py-6" aria-label="التنقل الرئيسي">
            {groups.map((group) => (
              <div key={group} className="shrink-0 lg:space-y-1">
                <p className="hidden px-3 pb-1 text-[11px] font-bold text-slate-400 lg:block">{group}</p>
                <div className="flex gap-2 lg:block lg:space-y-1">
                  {navigation.filter((item) => item.group === group).map((item) => (
                    <button key={item.id} type="button" onClick={() => setActive(item.id)} className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-right text-xs font-semibold transition sm:text-sm lg:block lg:w-full ${active === item.id ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="hidden border-t border-slate-100 px-4 pt-6 lg:block">
            <p className="text-xs leading-6 text-slate-400">الاستيراد والمطابقة منفصلان عن إعداد المؤسسة ويبدآن من مساحة العمل.</p>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {active === "overview" ? (
            <>
              <div className="border-b border-slate-200 pb-7 sm:pb-8">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold tracking-[0.12em] text-slate-400 sm:text-sm">OVERVIEW</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl lg:text-[2.15rem]">لنبدأ ببناء النموذج المالي</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500 sm:text-base sm:leading-8">ابدأ بالبيانات والاستيراد والتحقق، ثم المطابقة والنشر. بعد تأسيس البيانات الفعلية تبدأ وحدات الميزانية والتوقعات والفروقات والتدفق النقدي والسيناريوهات.</p>
                  </div>
                  <button type="button" onClick={() => setActive("data")} className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 sm:w-auto sm:px-6">الاستيراد والتحقق</button>
                </div>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <WorkspaceCard number="01" title="البيانات والاستيراد" text="رفع البيانات، التحقق من البنية والتوازن، ثم تجهيزها للمطابقة." action="فتح مركز البيانات" onClick={() => setActive("data")} />
                <WorkspaceCard number="02" title="البيانات الفعلية" text="لا تظهر أرقام فعلية قبل اكتمال التحقق والمطابقة والنشر." action="عرض الحالة" onClick={() => setActive("actuals")} />
                <WorkspaceCard number="03" title="التخطيط والتحليل" text="الميزانية والتوقعات والفروقات والتدفق النقدي والسيناريوهات تأتي بعد تأسيس البيانات." />
              </div>

              <div className="mt-8">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="text-xs font-bold text-slate-400">PLANNING</p><h3 className="mt-1 text-lg font-bold text-slate-950 sm:text-xl">وحدات التخطيط المالي</h3></div>
                  <span className="text-xs text-slate-400">بعد تثبيت البيانات الفعلية</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {planningModules.map((module) => <article key={module.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h4 className="font-bold text-slate-950">{module.title}</h4><p className="mt-2 text-sm leading-7 text-slate-500">{module.text}</p><span className="mt-5 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-400">قيد البناء</span></article>)}
                </div>
              </div>
            </>
          ) : active === "actuals" ? (
            <ModuleState title="البيانات الفعلية" eyebrow="ACTUALS" text="النموذج المالي الفعلي يعرض فقط البيانات التي اجتازت التحقق والمطابقة وتم نشرها بنجاح." href="/workspace/actuals" action="فتح البيانات الفعلية" />
          ) : active === "data" ? (
            <ModuleState title="الاستيراد والتحقق" eyebrow="DATA & IMPORTS" text="رفع Excel أو CSV والتحقق من بنية القيود قبل الانتقال إلى المطابقة. الاستيراد جزء من دورة البيانات داخل مساحة العمل، وليس من نموذج تعريف المؤسسة." href="/workspace/data" action="فتح مركز الاستيراد" />
          ) : (
            <ModuleState title="هذه الوحدة قيد البناء" eyebrow={active.toUpperCase()} text="سيتم بناء هذه الوحدة بعد تثبيت البيانات الفعلية والتحقق منها، وفق ترتيب التنفيذ المحدد في وثائق المشروع." />
          )}
        </section>
      </div>
    </main>
  );
}

function WorkspaceCard({ number, title, text, action, onClick }: { number: string; title: string; text: string; action?: string; onClick?: () => void }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold text-slate-400">{number}</p>
      <h3 className="mt-2 font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-500">{text}</p>
      {action && onClick && <button type="button" onClick={onClick} className="mt-5 text-sm font-bold text-slate-900 hover:underline">{action} ←</button>}
    </article>
  );
}

function ModuleState({ title, eyebrow, text, href, action }: { title: string; eyebrow: string; text: string; href?: string; action?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-12">
      <p className="text-xs font-bold tracking-[0.14em] text-slate-400">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base sm:leading-8">{text}</p>
      {href && action && <a href={href} className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-bold text-white sm:w-auto">{action}</a>}
    </div>
  );
}
