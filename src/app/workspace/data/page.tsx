"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const sections = [
  { title: "دليل الحسابات", subtitle: "شجرة الحسابات التي يُبنى عليها التصنيف والتحليل والقوائم المالية", href: "/workspace/data/accounts", action: "فتح دليل الحسابات", permission: "screen.accounts.view", formats: ["XLSX", "CSV"] },
  { title: "القيود اليومية", subtitle: "الحركات المالية التفصيلية التي يمكن تحويلها إلى بيانات فعلية معتمدة", href: "/workspace/data/import", action: "استيراد القيود", permission: "screen.data.view", formats: ["XLSX", "CSV"] },
  { title: "ميزان المراجعة", subtitle: "أرصدة الحسابات حسب الفترة عندما لا تتوفر الحركات التفصيلية", href: "/workspace/trial-balance", action: "فتح ميزان المراجعة", permission: "screen.trial_balance.view", formats: ["XLSX", "CSV"] },
  { title: "الإدخال اليدوي", subtitle: "إضافة بيانات مالية يدويًا عند الحاجة بدلًا من رفع ملف", href: "/workspace/data/manual", action: "الإدخال اليدوي", permission: "screen.data.view", formats: ["يدوي"] },
  { title: "البيانات الفعلية", subtitle: "البيانات التي اجتازت التحقق والمطابقة وأصبحت جزءًا من النموذج المالي", href: "/workspace/actuals", action: "عرض Actuals", permission: "screen.actuals.view", formats: [] },
  { title: "سجل البيانات", subtitle: "تتبع عمليات الاستيراد وحالتها ومصدرها بدل فقدان أثر البيانات", href: "/workspace/data/history", action: "عرض السجل", permission: "screen.data_history.view", formats: [] },
];

export default function FinancialDataHub() {
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    async function load() {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseBrowserClient();
      const organizationId = window.sessionStorage.getItem("activeOrganizationId");
      if (!organizationId) return;
      const { data } = await supabase.rpc("get_my_org_access", { p_organization_id: organizationId });
      if (alive) setAllowed(new Set((data ?? []).filter((row: { granted?: boolean }) => row.granted === true).map((row: { permission_key?: string }) => row.permission_key).filter(Boolean)));
    }
    void load();
    return () => { alive = false; };
  }, []);

  return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-[10px] font-bold tracking-[0.16em] text-slate-400">FINANCIAL DATA HUB</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold text-slate-950">مركز البيانات المالية</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">مكان واحد لإدارة مصادر البيانات المالية وتجهيزها قبل استخدامها في التخطيط والتحليل والتقارير. كل مصدر يحتفظ بدوره ولا يتم خلط القيود بميزان المراجعة أو دليل الحسابات.</p></div><span className="text-xs font-semibold text-slate-400">CSV · XLSX · إدخال يدوي</span></div>
      </div>
    </header>

    <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="border border-slate-200 bg-white">
        {sections.map((section, index) => {
          const canOpen = allowed.has(section.permission);
          return <div key={section.href} className={`flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${index > 0 ? "border-t border-slate-100" : ""}`}>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold text-slate-950 sm:text-base">{section.title}</h2>{section.formats.map((format) => <span key={format} className="border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500">{format}</span>)}</div><p className="mt-1 max-w-3xl text-xs leading-6 text-slate-500 sm:text-sm">{section.subtitle}</p></div>
            {canOpen ? <Link href={section.href} className="shrink-0 text-xs font-bold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950">{section.action} ←</Link> : <span className="shrink-0 text-[11px] font-semibold text-slate-400">لا توجد صلاحية</span>}
          </div>;
        })}
      </div>

      <div className="mt-6 border border-slate-200 bg-white px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold text-slate-400">دورة البيانات</p><h2 className="mt-1 text-sm font-bold text-slate-950">من المصدر إلى الرقم المعتمد</h2><p className="mt-2 text-xs leading-6 text-slate-500">اختيار النوع → رفع الملف → اكتشاف الأعمدة → المطابقة → التحقق → المعاينة → الاستيراد → المطابقة المالية → النشر. لا تصبح البيانات مصدرًا authoritative قبل نجاح التحقق والنشر.</p></div><Link href="/workspace/data/import" className="shrink-0 text-xs font-bold text-slate-700 underline decoration-slate-300 underline-offset-4">بدء استيراد ←</Link></div>
      </div>
    </section>
  </main>;
}
