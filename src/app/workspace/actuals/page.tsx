"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatNumber, formatMoneyMinor } from "@/lib/format";

type FactSummary = { revenue:number; cogs:number; operatingExpense:number; otherIncome:number; otherExpense:number; financeCost:number; tax:number; netIncome:number; rows:number };
const initialSummary: FactSummary = { revenue:0, cogs:0, operatingExpense:0, otherIncome:0, otherExpense:0, financeCost:0, tax:0, netIncome:0, rows:0 };

export default function ActualsPage() {
  const [summary,setSummary] = useState<FactSummary>(initialSummary);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if(active){setError("يجب تسجيل الدخول لعرض البيانات الفعلية");setLoading(false);} return; }
      const organizationId = window.sessionStorage.getItem("activeOrganizationId") || localStorage.getItem("activeOrganizationId");
      if (!organizationId) { if(active){setError("لا توجد شركة نشطة محددة");setLoading(false);} return; }
      const { data, error: queryError } = await supabase.rpc("get_actuals_summary", { p_organization_id: organizationId });
      if(queryError || !data){if(active){setError(queryError?.message || "تعذر قراءة البيانات الفعلية المنشورة");setLoading(false);}return;}
      const next: FactSummary = {
        revenue:Number(data.revenue)||0, cogs:Number(data.cogs)||0, operatingExpense:Number(data.operating_expense)||0,
        otherIncome:Number(data.other_income)||0, otherExpense:Number(data.other_expense)||0, financeCost:Number(data.finance_cost)||0,
        tax:Number(data.tax)||0, netIncome:Number(data.net_income)||0, rows:Number(data.rows)||0,
      };
      if(active){setSummary(next);setLoading(false);}
    };
    void load(); return()=>{active=false;};
  },[]);

  const cards:[string,number,string][] = [
    ["الإيرادات",summary.revenue,"Revenue"],
    ["تكلفة المبيعات",summary.cogs,"Cost of sales"],
    ["مجمل الربح",summary.revenue-summary.cogs,"Gross profit"],
    ["المصروفات التشغيلية",summary.operatingExpense,"Operating expenses"],
    ["EBITDA",summary.revenue-summary.cogs-summary.operatingExpense,"Operating performance"],
    ["صافي الربح",summary.netIncome,"Net income"],
  ];
  return <main className="min-h-screen bg-slate-50 text-slate-900" dir="rtl">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/workspace" className="inline-flex min-h-10 items-center border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">← مساحة العمل</Link>
        <div className="text-right"><p className="eyebrow">ACTUALS / DATA</p><h1 className="section-title mt-1 text-lg">النموذج المالي الفعلي</h1></div>
      </div>
    </header>
    <section className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
      <div className="border-b border-slate-200 pb-7">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div><p className="eyebrow">01 / ACTUALS</p><h2 className="section-title mt-2 text-3xl sm:text-4xl">البيانات الفعلية</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">قراءة مباشرة للبيانات المالية الفعلية التي تم نشرها واعتمادها. هذه الصفحة للعرض والتحقق وليست شاشة إدخال.</p></div>
          <div className="border border-slate-200 bg-white px-4 py-3"><p className="text-[10px] font-bold text-slate-400">DATA STATUS</p><p className="mt-1 text-sm font-black text-slate-950">{loading?"جاري التحقق…":summary.rows>0?"بيانات منشورة":"لا توجد بيانات"}</p></div>
        </div>
      </div>
      {error ? <div role="alert" className="mt-6 border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : <>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(([label,value,en])=><article key={label} className="saas-card saas-card-hover p-5 sm:p-6"><p className="text-[9px] font-black tracking-[0.14em] text-slate-400">{en}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p><p className="mt-3 text-2xl font-black text-slate-950 tabular-nums sm:text-3xl">{loading?"…":formatMoneyMinor(value)}</p><p className="mt-2 text-[10px] text-slate-400">ريال سعودي</p></article>)}
        </div>
        <section className="saas-card mt-5 overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><p className="eyebrow">PUBLISHED FACTS</p><h3 className="mt-1 text-base font-extrabold text-slate-950">حالة البيانات المنشورة</h3><p className="mt-1 text-xs leading-6 text-slate-500 sm:text-sm">المصدر هو Financial Facts بحالة Actual / Published.</p></div>
          <div className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
            <div><p className="text-[10px] font-bold text-slate-400">عدد السجلات المنشورة</p><p className="mt-1 text-xl font-black text-slate-950">{loading?"…":formatNumber(summary.rows)}</p></div>
            <div><p className="text-[10px] font-bold text-slate-400">الحالة</p><p className="mt-1 text-xl font-black text-slate-950">{loading?"…":summary.rows>0?"منشور":"لا توجد بيانات"}</p></div>
            <div className="flex items-end"><Link href="/workspace/data/import" className="inline-flex min-h-11 w-full items-center justify-center bg-slate-950 px-5 py-3 text-xs font-extrabold text-white transition hover:bg-slate-800 sm:w-auto">إدارة البيانات ←</Link></div>
          </div>
        </section>
      </>}
    </section>
  </main>;
}
