"use client";
import { useEffect,useMemo,useState } from "react";
import Link from "next/link";
import FinancialWorkflow from "@/components/workspace/financial-workflow";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
type Access={permission_key?:string;granted?:boolean};
const items=[
 ["screen.financial_analysis.view","التحليل المالي","تحليل الربحية والمؤشرات المالية من البيانات المنشورة.","/workspace/financial-analysis","◒"],
 ["screen.variance.view","الفروقات","فهم الفرق بين الفعلي والميزانية والتنبؤ والعوامل المؤثرة.","/workspace/variance","±"],
 ["screen.cash.view","التدفق النقدي","متابعة السيولة والتدفقات والتغير في رأس المال العامل.","/workspace/cash","↗"]
] as const;
export default function AnalysisHub(){
 const[allowed,setAllowed]=useState<Set<string>>(new Set());
 useEffect(()=>{const s=getSupabaseBrowserClient();const id=window.sessionStorage.getItem("activeOrganizationId");if(!id)return;void s.rpc("get_my_org_access",{p_organization_id:id}).then(({data}: { data: Access[] | null })=>setAllowed(new Set((data??[]).filter((x:Access)=>x.granted).map((x:Access)=>x.permission_key).filter(Boolean) as string[])))},[]);
 const visible=useMemo(()=>items.filter(x=>allowed.has(x[0])),[allowed]);
 return <main dir="rtl" className="min-h-[calc(100vh-84px)] bg-[#f7f8fa]"><header className="border-b border-slate-200 bg-white"><div className="px-4 py-6 sm:px-6 lg:px-8"><p className="eyebrow">FINANCIAL ANALYSIS</p><h1 className="mt-1 text-2xl font-bold text-slate-950">التحليل المالي</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">بعد اعتماد البيانات والخطة، هنا تفهم ما حدث، ما الذي تغيّر، وكيف انعكس على الربحية والسيولة.</p></div></header><section className="px-4 py-6 sm:px-6 lg:px-8"><FinancialWorkflow /><div className="mt-5"><div className="border border-slate-200 bg-white">{visible.map(([perm,title,desc,href,icon],i)=><Link key={href} href={href} className={`group flex items-center gap-5 p-6 transition hover:bg-slate-50 ${i?"border-t border-slate-100":""}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-200 text-sm text-slate-500">{icon}</span><span className="min-w-0 flex-1"><span className="block text-base font-extrabold text-slate-950">{title}</span><span className="mt-1 block text-sm leading-6 text-slate-500">{desc}</span></span><span className="text-xs font-bold text-slate-500 group-hover:text-slate-950">فتح ←</span></Link>)}{visible.length===0&&<div className="p-8 text-sm text-slate-500">لا توجد وحدات تحليل متاحة للصلاحيات الحالية.</div>}</div></div></section></main>
}
