"use client";
import Link from "next/link";
import FinancialWorkflow from "@/components/workspace/financial-workflow";
import { useEffect,useState } from "react";
type Access={permission_key?:string;granted?:boolean};
const sections=[
 {title:"إدخال البيانات",subtitle:"أدخل قيدًا يدويًا أو ارفع ملف القيود. بعد التحقق ينتقل المصدر إلى المراجعة ثم النشر.",href:"/workspace/data/import",action:"بدء إدخال البيانات",permission:"screen.data.view"},
 {title:"قيود اليومية",subtitle:"ابحث في القيود المنشورة، افتح تفاصيل أي قيد، وعدّل القيد المنشور بإصدار جديد مع حفظ الأثر.",href:"/workspace/data/journals",action:"فتح القيود",permission:"screen.actuals.view"},
 {title:"دليل الحسابات والأرصدة الافتتاحية",subtitle:"جهّز الأساس المحاسبي للشركة قبل الحركة: الحسابات والأرصدة الافتتاحية.",href:"/workspace/data/accounts",action:"إدارة الأساس المحاسبي",permission:"screen.accounts.view"},
 {title:"ميزان المراجعة",subtitle:"تحقق من أرصدة الحسابات والحركة والافتتاح والإغلاق بعد اعتماد البيانات.",href:"/workspace/trial-balance",action:"فتح الميزان",permission:"screen.trial_balance.view"}
];
export default function FinancialDataHub(){
 const[allowed,setAllowed]=useState<Set<string>>(new Set());

 useEffect(()=>{let alive=true;async function load(){const{getSupabaseBrowserClient}=await import("@/lib/supabase/client");const s=getSupabaseBrowserClient();const id=window.sessionStorage.getItem("activeOrganizationId");if(!id)return;const{data}=await s.rpc("get_my_org_access",{p_organization_id:id});if(alive)setAllowed(new Set((data??[]).filter((x:Access)=>x.granted).map((x:Access)=>x.permission_key).filter(Boolean) as string[]))}void load();return()=>{alive=false}},[]);
 return <main dir="rtl" className="min-h-[calc(100vh-84px)] bg-[#f7f8fa] text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="px-4 py-6 sm:px-6 lg:px-8"><p className="eyebrow">FINANCIAL DATA</p><h1 className="mt-1 text-2xl font-bold text-slate-950">البيانات المالية</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">ابدأ من المصدر، راجع واعتمد البيانات، ثم استخدم نفس البيانات في ميزان المراجعة والقوائم والتحليل. لا تحتاج إلى التنقل بين شاشات داخلية إلا عند الحاجة.</p></div></header><section className="px-4 py-6 sm:px-6 lg:px-8"><FinancialWorkflow /><div className="mt-5"><div className="border border-slate-200 bg-white">{sections.map((x,i)=>{const can=allowed.has(x.permission);return <div key={x.href} className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${i?"border-t border-slate-100":""}`}><div><h2 className="text-base font-extrabold text-slate-950">{x.title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{x.subtitle}</p></div>{can?<Link href={x.href} className="shrink-0 text-xs font-bold text-slate-700 underline decoration-slate-300 underline-offset-4">{x.action} ←</Link>:<span className="text-[11px] text-slate-400">لا توجد صلاحية</span>}</div>})}</div><div className="mt-5 border border-slate-200 bg-slate-950 p-5 text-white"><p className="eyebrow text-slate-500">WORKFLOW</p><h2 className="mt-1 text-base font-extrabold">المسار المقترح</h2><p className="mt-2 text-sm leading-7 text-slate-300">إدخال أو استيراد → تحقق ومراجعة → نشر → ميزان مراجعة → قوائم وتحليل → لوحة الإدارة.</p></div></div></section></main>
}
