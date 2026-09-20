"use client";
import { useEffect,useMemo,useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
type Access={permission_key?:string;granted?:boolean};
const items=[
 ["screen.budget.view","الميزانية","بناء الخطة المالية حسب الفترات والحسابات والأبعاد ومسار الاعتماد.","/workspace/budget","□"],
 ["screen.forecast.view","التنبؤ المالي","قراءة الاتجاه المستقبلي والتحقق التاريخي ومقارنة التنبؤ بالفعلي.","/workspace/forecast","⌁"],
 ["screen.scenarios.view","السيناريوهات","اختبار What If وتأثير الافتراضات قبل اعتماد القرار.","/workspace/scenarios","◇"]
] as const;
export default function PlanningHub(){
 const[allowed,setAllowed]=useState<Set<string>>(new Set());
 useEffect(()=>{const s=getSupabaseBrowserClient();const id=window.sessionStorage.getItem("activeOrganizationId");if(!id)return;void s.rpc("get_my_org_access",{p_organization_id:id}).then(({data}: { data: Access[] | null })=>setAllowed(new Set((data??[]).filter((x:Access)=>x.granted).map((x:Access)=>x.permission_key).filter(Boolean) as string[])))},[]);
 const visible=useMemo(()=>items.filter(x=>allowed.has(x[0])),[allowed]);
 return <main dir="rtl" className="min-h-[calc(100vh-84px)] bg-[#f7f8fa]"><header className="border-b border-slate-200 bg-white"><div className="px-4 py-6 sm:px-6 lg:px-8"><p className="eyebrow">FINANCIAL PLANNING</p><h1 className="mt-1 text-2xl font-bold text-slate-950">التخطيط المالي</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">مساحة واحدة لكل ما يجيب عن سؤال: ماذا نخطط له، وإلى أين نتجه، وماذا يحدث إذا تغيّرت الافتراضات؟</p></div></header><section className="px-4 py-6 sm:px-6 lg:px-8"><div className="border border-slate-200 bg-white">{visible.map(([perm,title,desc,href,icon],i)=><Link key={href} href={href} className={`group flex items-center gap-5 p-6 transition hover:bg-slate-50 ${i?"border-t border-slate-100":""}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-200 text-sm text-slate-500">{icon}</span><span className="min-w-0 flex-1"><span className="block text-base font-extrabold text-slate-950">{title}</span><span className="mt-1 block text-sm leading-6 text-slate-500">{desc}</span></span><span className="text-xs font-bold text-slate-500 group-hover:text-slate-950">فتح ←</span></Link>)}{visible.length===0&&<div className="p-8 text-sm text-slate-500">لا توجد وحدات تخطيط متاحة للصلاحيات الحالية.</div>}</div><p className="mt-4 text-xs text-slate-400">التنبؤ المالي وحدة مستقلة؛ لا يتم دمجه داخل لوحة الإدارة أو الميزانية.</p></section></main>
}
