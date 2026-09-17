"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type OnboardingStatus = {
  organization_id: string;
  company_name: string;
  initial_data_source: string | null;
  completed: boolean;
  next_route: string;
};

type SourceKey = "excel" | "manual" | "integration";

type OnboardingStatusRpcResult = {
  data: OnboardingStatus[] | null;
  error: { message?: string } | null;
};

type CompleteOnboardingRpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

const sources: Array<{ key: SourceKey; title: string; description: string; next: string; label: string }> = [
  { key: "excel", title: "لدي ملف Excel أو CSV", description: "سأرفع البيانات الفعلية وأمر على التحقق والمطابقة والمراجعة قبل النشر.", next: "/workspace/data", label: "البيانات والاستيراد" },
  { key: "manual", title: "سأبدأ من دليل الحسابات", description: "سأبني دليل حسابات الشركة أولًا ثم أستكمل ميزان المراجعة والبيانات.", next: "/workspace/data/accounts", label: "دليل الحسابات" },
  { key: "integration", title: "لدي نظام أريد ربطه", description: "سأبدأ من مصادر البيانات والموصلات ثم أجهز أول عملية مزامنة.", next: "/workspace/data-monitoring/connectors", label: "مصادر البيانات والموصلات" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [selected, setSelected] = useState<SourceKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.replace("/login?next=/onboarding"); return; }
      const organizationId = window.sessionStorage.getItem("activeOrganizationId");
      if (!organizationId) { router.replace("/start"); return; }
      const result = await (supabase.rpc as any)("get_company_onboarding_status", { p_organization_id: organizationId }) as OnboardingStatusRpcResult;
      const { data, error: rpcError } = result;
      if (rpcError || !data?.[0]) { if (active) { setError(rpcError?.message ?? "تعذر تحميل إعداد الشركة."); setLoading(false); } return; }
      const row = data[0];
      if (row.completed) { router.replace(row.next_route); return; }
      if (active) { setStatus(row); setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function finish() {
    if (!selected || !status) return;
    setSaving(true); setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const result = await (supabase.rpc as any)("complete_company_onboarding", {
        p_organization_id: status.organization_id,
        p_initial_data_source: selected,
      }) as CompleteOnboardingRpcResult;
      const { data, error: rpcError } = result;
      if (rpcError) throw rpcError;
      const next = typeof data === "string" ? data : sources.find((item) => item.key === selected)?.next;
      if (!next) throw new Error("تعذر تحديد الخطوة التالية.");
      router.replace(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر حفظ إعداد الشركة.");
    } finally { setSaving(false); }
  }

  if (loading) return <CenteredState text="جارٍ تجهيز إعداد الشركة…" />;

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-6 text-[#172033] sm:px-6 lg:px-10" dir="rtl">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between border-b border-slate-200 pb-5">
          <div><p className="text-xs font-bold tracking-[0.16em] text-slate-400">FP&A ONBOARDING</p><p className="mt-1 font-bold text-slate-950">إعداد الشركة</p></div>
          <button type="button" onClick={() => router.push("/start")} className="text-sm font-semibold text-slate-500 hover:text-slate-950">← شركاتي</button>
        </header>

        <section className="mx-auto max-w-4xl py-8 sm:py-12 lg:py-16">
          <div className="mb-8 sm:mb-10"><p className="text-xs font-bold tracking-[0.14em] text-slate-400">الخطوة 2 من 3</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">كيف ستدخل بيانات {status?.company_name}؟</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">اختر نقطة البداية فقط. لن ندخلك إلى لوحة فارغة؛ سنرسلك مباشرة إلى أول خطوة عملية لبناء النموذج المالي.</p></div>

          <div className="grid gap-4 lg:grid-cols-3">
            {sources.map((source) => {
              const active = selected === source.key;
              return <button key={source.key} type="button" onClick={() => setSelected(source.key)} aria-pressed={active} className={`text-right rounded-2xl border p-5 transition sm:p-6 ${active ? "border-slate-950 bg-slate-950 text-white shadow-md" : "border-slate-200 bg-white text-slate-950 hover:border-slate-400 hover:shadow-sm"}`}><span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-white text-slate-950" : "bg-slate-100 text-slate-600"}`}>{active ? "✓" : ""}</span><h2 className="mt-5 text-lg font-bold">{source.title}</h2><p className={`mt-3 text-sm leading-7 ${active ? "text-slate-200" : "text-slate-500"}`}>{source.description}</p><span className={`mt-5 block text-xs font-bold ${active ? "text-slate-300" : "text-slate-400"}`}>سيتم فتح: {source.label}</span></button>;
            })}
          </div>

          {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700" role="alert">{error}</div>}

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-3"><Step number="1" title="بيانات الشركة" done /><Step number="2" title="مصدر البيانات" active /><Step number="3" title="أول خطوة مالية" /></div>
            <button type="button" disabled={!selected || saving} onClick={() => void finish()} className="mt-7 w-full rounded-xl bg-slate-950 px-6 py-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{saving ? "جارٍ حفظ الإعداد…" : "متابعة إلى أول خطوة"}</button>
          </section>
        </section>
      </div>
    </main>
  );
}

function Step({ number, title, done, active }: { number: string; title: string; done?: boolean; active?: boolean }) { return <div className="flex items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-100 text-emerald-700" : active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-400"}`}>{done ? "✓" : number}</span><span className={`text-sm font-semibold ${active ? "text-slate-950" : "text-slate-500"}`}>{title}</span></div>; }
function CenteredState({ text }: { text: string }) { return <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl"><div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4"><div className="w-full rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"><p className="text-xs font-bold tracking-[0.16em] text-slate-400">FP&A</p><p className="mt-4 font-semibold text-slate-800">{text}</p></div></div></main>; }
