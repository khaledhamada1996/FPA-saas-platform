"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AccessRow={permission_key?:string;granted?:boolean};
type NavItem=readonly [string,string,string,string];
type NavSection=readonly [string,readonly NavItem[]][];

const navigation:NavSection=[
 ["مساحة العمل",[["workspace.home.view","الرئيسية","/workspace","⌂"]]],
 ["الإدارة",[["screen.executive_dashboard.view","لوحة الإدارة","/workspace/executive-dashboard","▦"],["screen.connector_management.view","تكامل الأنظمة","/workspace/integrations","⇄"],["screen.data_monitoring.view","مراقبة البيانات","/workspace/data-monitoring","◌"]]],
 ["الدورة المالية",[
   ["screen.data.view","البيانات المالية","/workspace/data","◈"],
   ["screen.data.view","سجل الاستيرادات","/workspace/data/history","↶"],
   ["screen.budget.view","التخطيط المالي","/workspace/planning","□"],
   ["screen.financial_analysis.view","التحليل المالي","/workspace/analysis","◒"],
   ["screen.financial_statements.view","القوائم والتقارير","/workspace/financial-statements","▤"]
 ]],
 ["إدارة النظام",[["screen.team.view","الفريق والصلاحيات","/workspace/team","♙"],["screen.audit.view","سجل العمليات","/workspace/audit","◷"],["screen.company_profile.view","ملف الشركة","/workspace/company-profile","○"]]]
];

function NavLink({item,allowed,pathname}:{item:NavItem;allowed:Set<string>;pathname:string}){
 const enabled=item[0]==="workspace.home.view"||allowed.has(item[0]);
 const active=pathname===item[2]||pathname.startsWith(`${item[2]}/`);
 const cls=`group flex min-h-10 items-center gap-2.5 border border-transparent px-3 text-[12px] transition ${active?"border-slate-200 bg-slate-100 font-bold text-slate-950":"font-semibold text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"}`;
 if(!enabled)return <div aria-disabled="true" title={`ليس لديك صلاحية الدخول إلى ${item[1]}`} className={`${cls} cursor-not-allowed text-slate-300 hover:bg-transparent hover:text-slate-300`}><span className="w-5 text-center text-[11px]">{item[3]}</span><span className="truncate">{item[1]}</span><span className="mr-auto text-[9px]">🔒</span></div>;
 return <Link href={item[2]} title={item[1]} aria-current={active?"page":undefined} className={cls}><span className={`flex h-5 w-5 items-center justify-center text-[11px] ${active?"text-slate-700":"text-slate-400 group-hover:text-slate-700"}`}>{item[3]}</span><span className="truncate">{item[1]}</span></Link>;
}
export default function WorkspaceSidebar(){
 const pathname=usePathname()||"/workspace"; const[access,setAccess]=useState<AccessRow[]>([]);
 useEffect(()=>{const s=getSupabaseBrowserClient();let alive=true;async function load(){const{data:user}=await s.auth.getUser();if(!user.user)return;const id=window.sessionStorage.getItem("activeOrganizationId");if(!id)return;const{data}=await s.rpc("get_my_org_access",{p_organization_id:id});if(alive)setAccess((data??[]) as AccessRow[])}void load();return()=>{alive=false}},[pathname]);
 const allowed=useMemo(()=>new Set(access.filter(x=>x.granted===true).map(x=>x.permission_key).filter(Boolean) as string[]),[access]);
 return <aside className="fixed bottom-0 right-0 top-[84px] z-40 hidden w-[248px] overflow-y-auto border-l border-slate-200 bg-white lg:block"><div className="px-3 pb-4 pt-4"><div className="mb-4 border border-slate-200 bg-slate-50 p-3"><p className="eyebrow">FINANCIAL WORKSPACE</p><p className="mt-1 text-xs font-bold text-slate-950">الدورة المالية</p><p className="mt-1 text-[10px] leading-4 text-slate-500">بيانات ← تخطيط ← تحليل ← تقارير</p></div><nav className="space-y-4">{navigation.map(([section,items])=><section key={section}><h2 className="px-3 pb-1.5 text-[9px] font-extrabold tracking-wide text-slate-400">{section}</h2><div className="space-y-1">{items.map(item=><NavLink key={item[2]} item={item} allowed={allowed} pathname={pathname}/>)}</div></section>)}</nav></div></aside>
}