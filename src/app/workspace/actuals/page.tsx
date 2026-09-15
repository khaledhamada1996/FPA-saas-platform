"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type FactSummary = { revenue:number; cogs:number; operatingExpense:number; otherIncome:number; otherExpense:number; financeCost:number; tax:number; netIncome:number; rows:number };
const initialSummary: FactSummary = { revenue:0, cogs:0, operatingExpense:0, otherIncome:0, otherExpense:0, financeCost:0, tax:0, netIncome:0, rows:0 };
const money = (value:number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits:0 }).format(value);

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
      const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id",auth.user.id).limit(1).maybeSingle();
      if (!membership?.organization_id) { if(active){setError("لا توجد منشأة مرتبطة بالمستخدم الحالي");setLoading(false);} return; }
      const { data, error: queryError } = await supabase.rpc("get_actuals_summary", { p_organization_id: membership.organization_id });
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

  const cards:[string,number][] = [["الإيرادات",summary.revenue],["تكلفة المبيعات",summary.cogs],["مجمل الربح",summary.revenue-summary.cogs],["المصروفات التشغيلية",summary.operatingExpense],["EBITDA",summary.revenue-summary.cogs-summary.operatingExpense],["صافي الربح",summary.netIncome]];
  return <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"><Link href="/workspace" className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-950 sm:text-sm">العودة لمساحة العمل</Link><div className="min-w-0 text-right"><p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 sm:text-xs">ACTUALS</p><h1 className="mt-1 truncate text-base font-bold text-slate-950 sm:text-lg">النموذج المالي الفعلي</h1></div></div></header>
    <section className="mx-auto w-full px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
      <div className="border-b border-slate-200 pb-7 sm:pb-8"><p className="text-xs font-bold text-slate-400 sm:text-sm">المرحلة الثالثة</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">النموذج المالي الفعلي</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500 sm:text-base sm:leading-8">قراءة مباشرة للبيانات المالية الفعلية التي تم نشرها واعتمادها. هذه الصفحة للعرض والتحقق وليست شاشة إدخال.</p></div>
      {error ? <div className="mt-7 border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">{error}</div> : <>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label,value])=><article key={label} className="border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">{loading?"…":money(value)}</p><p className="mt-2 text-xs text-slate-400">ريال سعودي</p></article>)}</div>
        <section className="mt-5 border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-4 sm:p-6"><h3 className="font-bold text-slate-950">حالة البيانات المنشورة</h3><p className="mt-1 text-xs leading-6 text-slate-500 sm:text-sm">المصدر هو Financial Facts بحالة Actual / Published.</p></div><div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6"><div><p className="text-xs text-slate-400">عدد السجلات المنشورة</p><p className="mt-1 text-lg font-bold text-slate-950">{loading?"…":money(summary.rows)}</p></div><div><p className="text-xs text-slate-400">الحالة</p><p className="mt-1 text-lg font-bold text-emerald-700">{loading?"…":summary.rows>0?"منشور":"لا توجد بيانات"}</p></div><div><Link href="/workspace/data/import" className="inline-flex min-h-11 items-center justify-center bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">إدارة القيود اليومية</Link></div></div></section>
      </>}
    </section>
  </main>;
}
