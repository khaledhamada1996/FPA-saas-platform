"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import FinancialWorkflow from "@/components/workspace/financial-workflow";
type Company={id:string;name:string;role:string;role_key:string};
const roles:Record<string,string>={company_admin:"مدير النظام",admin:"مدير النظام",owner:"المالك",ceo:"الرئيس التنفيذي",cfo:"المدير المالي",finance_manager:"مدير مالي",fpa_analyst:"محلل FP&A",accountant:"محاسب",viewer:"مطلع",planner:"محلل FP&A"};
export default function WorkspacePage(){
 const[company,setCompany]=useState<Company|null>(null);const[loading,setLoading]=useState(true);
 useEffect(()=>{const supabase=getSupabaseBrowserClient();let alive=true;async function load(){const{data:user}=await supabase.auth.getUser();if(!user.user){window.location.href="/login?next=/workspace";return}const{data,error}=await supabase.rpc("get_my_workspaces");if(error||!data?.length){window.location.href="/start";return}const list=data as Company[];const activeId=window.sessionStorage.getItem("activeOrganizationId");const active=list.find(x=>x.id===activeId)||list[0];window.sessionStorage.setItem("activeOrganizationId",active.id);window.sessionStorage.setItem("selectedOrganizationIds",JSON.stringify([active.id]));if(alive){setCompany(active);setLoading(false)}}void load();return()=>{alive=false}},[]);
 if(loading||!company)return <section dir="rtl" className="flex min-h-[calc(100vh-84px)] items-center justify-center"><div className="text-center"><div className="mx-auto h-8 w-8 animate-pulse rounded-full bg-slate-200"/><p className="mt-3 text-sm text-slate-500">جارٍ تجهيز مساحة العمل…</p></div></section>;
 return <section dir="rtl" className="min-h-[calc(100vh-84px)] bg-[#f7f8fa]"><div className="mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
 <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
  <div><p className="eyebrow">FINANCIAL INTELLIGENCE WORKSPACE</p><h1 className="mt-1 text-2xl font-bold text-slate-950">مساحة العمل المالية</h1><p className="mt-2 text-sm leading-6 text-slate-500">كل ما تحتاجه لإدارة الدورة المالية في مسار واحد واضح من البيانات إلى القرار.</p></div>
  <div className="flex items-center gap-3 border border-slate-200 bg-white px-4 py-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{company.name.slice(0,1)}</span><span><span className="block text-[10px] text-slate-400">الشركة الحالية</span><span className="text-sm font-bold text-slate-900">{company.name}</span></span></div>
 </div>
 <div className="mt-5"><FinancialWorkflow /></div>
 <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_.5fr]">
  <section className="border border-slate-200 bg-white p-5 sm:p-6"><p className="eyebrow">NEXT ACTION</p><h2 className="mt-1 text-lg font-extrabold text-slate-950">ابدأ من البيانات المالية</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">أدخل أو استورد البيانات، ثم راجعها واعتمدها. بعد النشر تنتقل نفس البيانات تلقائيًا إلى الميزان والقوائم والتحليل والتخطيط.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/workspace/data" className="bg-blue-600 px-5 py-3 text-xs font-bold text-white hover:bg-blue-700">فتح مركز البيانات ←</Link><Link href="/workspace/data/journals" className="border border-slate-300 bg-white px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50">قيود اليومية</Link></div></section>
  <section className="border border-slate-200 bg-white p-5 sm:p-6"><p className="eyebrow">MANAGEMENT</p><h2 className="mt-1 text-lg font-extrabold text-slate-950">لوحة الإدارة</h2><p className="mt-2 text-sm leading-6 text-slate-500">الصورة التنفيذية تأتي بعد اعتماد البيانات والتحليل.</p><Link href="/workspace/executive-dashboard" className="mt-5 inline-flex text-xs font-bold text-slate-700 underline decoration-slate-300 underline-offset-4">فتح لوحة الإدارة ←</Link></section>
 </div>
 </div></section>
}