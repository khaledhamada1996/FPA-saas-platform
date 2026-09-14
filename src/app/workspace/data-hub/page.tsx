"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Summary = { imports: number; accounts: number };

export default function DataHubPage() {
  const [summary, setSummary] = useState<Summary>({ imports: 0, accounts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const organizationId = window.sessionStorage.getItem("activeOrganizationId");
    if (!organizationId) { setLoading(false); return; }
    const supabase = getSupabaseBrowserClient();
    async function load() {
      const [importsResult, accountsResult] = await Promise.all([
        supabase.from("import_batches").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
        supabase.rpc("get_chart_of_accounts", { p_organization_id: organizationId }),
      ]);
      setSummary({ imports: importsResult.count ?? 0, accounts: Array.isArray(accountsResult.data) ? accountsResult.data.length : 0 });
      setLoading(false);
    }
    void load();
  }, []);

  const cards = [
    { href: "/workspace/data", title: "البيانات والاستيراد", english: "DATA & IMPORTS", text: "استورد القيود والبيانات المالية، راجع المطابقة والتحقق، ثم انشر البيانات المعتمدة إلى مساحة العمل.", action: "فتح الاستيراد", tone: "border-cyan-200 bg-cyan-50/70", badge: "01" },
    { href: "/workspace/data/accounts", title: "دليل الحسابات", english: "CHART OF ACCOUNTS", text: "أنشئ ونظّم شجرة الحسابات، راجع التصنيفات والارتباط بالقوائم، واستعدها للاستخدام في التحليل والتخطيط.", action: "فتح دليل الحسابات", tone: "border-violet-200 bg-violet-50/70", badge: "02" },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/workspace" className="text-sm font-bold text-slate-500 hover:text-slate-950">العودة لمساحة العمل</Link>
          <div className="text-right"><p className="text-[10px] font-black tracking-[0.16em] text-slate-400">DATA CENTER</p><h1 className="mt-1 text-lg font-black text-slate-950">البيانات</h1></div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
          <div className="absolute left-0 top-0 h-40 w-40 rounded-full bg-cyan-100/70 blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-violet-100/70 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl"><span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black tracking-[0.15em] text-slate-500">SOURCE OF TRUTH</span><h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">كل بياناتك المالية تبدأ من هنا</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">مركز واحد لإدارة مصدر البيانات ودليل الحسابات قبل انتقال الأرقام إلى الميزانية والتوقع والتحليل والتقارير.</p></div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[330px]"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold text-slate-400">دفعات الاستيراد</p><p className="mt-2 text-2xl font-black text-slate-950">{loading ? "—" : summary.imports}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold text-slate-400">الحسابات</p><p className="mt-2 text-2xl font-black text-slate-950">{loading ? "—" : summary.accounts}</p></div></div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {cards.map((card) => <Link key={card.href} href={card.href} className={`group relative overflow-hidden rounded-3xl border p-6 transition duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-8 ${card.tone}`}><span className="absolute left-6 top-6 text-3xl font-black text-slate-200 sm:left-8 sm:top-8">{card.badge}</span><div className="max-w-xl"><p className="text-[10px] font-black tracking-[0.16em] text-slate-400">{card.english}</p><h3 className="mt-3 text-2xl font-black text-slate-950">{card.title}</h3><p className="mt-4 text-sm leading-7 text-slate-600">{card.text}</p><span className="mt-7 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-black text-white transition group-hover:bg-slate-800">{card.action}<span aria-hidden="true">←</span></span></div></Link>)}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[['البيانات الفعلية','Actuals','تغذي التحليل والقوائم والمقارنات'],['دليل الحسابات','Chart of Accounts','الهيكل المحاسبي الذي تُبنى عليه التقارير'],['التحقق والمطابقة','Validation & Mapping','طبقة ضبط قبل اعتماد البيانات']].map(([title, en, text]) => <div key={en} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-[9px] font-black tracking-[0.15em] text-slate-400">{en}</p><h3 className="mt-2 text-sm font-black text-slate-950">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{text}</p></div>)}
        </div>
      </section>
    </main>
  );
}
