"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AccessRow={permission_key?:string;granted?:boolean}; type NavItem=readonly[string,string,string]; type NavSection=readonly[string,readonly NavItem[]];
const navigation:NavSection[]=[
 ["البيانات والنموذج المالي",[
  ["screen.data.view","مركز البيانات المالية","/workspace/data"],
  ["screen.actuals.view","النموذج المالي الفعلي","/workspace/actuals"],
  ["screen.trial_balance.view","ميزان المراجعة","/workspace/trial-balance"]
 ]],
 ["التقارير المالية",[
  ["screen.financial_statements.view","القوائم المالية","/workspace/financial-statements"],
  ["screen.reports.view","التقارير","/workspace/reports"],
  ["screen.group_reporting.view","تقارير المجموعة","/workspace/group-reporting"],
  ["screen.financial_statements.view","الزكاة وضريبة الدخل","/workspace/tax-zakat"]
 ]],
 ["التحليل المالي",[
  ["screen.financial_analysis.view","التحليل المالي","/workspace/financial-analysis"],
  ["screen.variance.view","الفروقات","/workspace/variance"],
  ["screen.cash.view","التدفق النقدي","/workspace/cash"],
  ["screen.ai_analyst.view","المحلل المالي الذكي","/workspace/ai-analyst"]
 ]],
 ["التخطيط والتوقعات",[
  ["screen.budget.view","الميزانية","/workspace/budget"],
  ["screen.forecast.view","التوقعات","/workspace/forecast"],
  ["screen.scenarios.view","السيناريوهات","/workspace/scenarios"]
 ]],
 ["الإدارة والحوكمة",[
  ["screen.executive_dashboard.view","لوحة المؤشرات","/workspace/executive-dashboard"],
  ["screen.dimensions.view","الأبعاد","/workspace/dimensions"],
  ["screen.team.view","الفريق والصلاحيات","/workspace/team"],
  ["screen.audit.view","سجل العمليات","/workspace/audit"],
  ["screen.company_profile.view","ملف الشركة","/workspace/company-profile"]
 ]]
];
function NavLink({item,allowed,pathname}:{item:NavItem;allowed:Set<string>;pathname:string}){const enabled=allowed.has(item[0]);const active=pathname===item[2]||pathname.startsWith(`${item[2]}/`);const cls=`flex items-center justify-between border-b border-slate-100 px-3 py-2.5 text-sm ${active?"bg-slate-50 font-bold text-slate-950":enabled?"font-semibold text-slate-700 hover:bg-slate-50":"cursor-not-allowed text-slate-400"}`;if(!enabled)return <div aria-disabled="true" title={`ليس لديك صلاحية الدخول إلى ${item[1]}`} className={cls}><span className="truncate">{item[1]}</span><span>🔒</span></div>;return <Link href={item[2]} title={item[1]} aria-current={active?"page":undefined} className={cls}><span className="truncate">{item[1]}</span><span>›</span></Link>}
export default function WorkspaceSidebar(){const pathname=usePathname()||"/workspace";const[access,setAccess]=useState<AccessRow[]>([]);useEffect(()=>{const s=getSupabaseBrowserClient();let alive=true;async function load(){const{data:user}=await s.auth.getUser();if(!user.user)return;const id=window.sessionStorage.getItem("activeOrganizationId");if(!id)return;const{data}=await s.rpc("get_my_org_access",{p_organization_id:id});if(alive)setAccess((data??[]) as AccessRow[])}void load();return()=>{alive=false}},[pathname]);const allowed=useMemo(()=>new Set(access.filter(x=>x.granted===true).map(x=>x.permission_key).filter(Boolean) as string[]),[access]);const enabledCount=navigation.flatMap(([,items])=>items).filter(x=>allowed.has(x[0])).length;const totalCount=navigation.reduce((n,[,items])=>n+items.length,0);return <aside className="fixed bottom-0 right-0 top-[84px] z-40 hidden w-[270px] overflow-y-auto border-l border-slate-200 bg-white p-3 lg:block"><div className="mb-3 border-b border-slate-100 px-3 pb-3"><p className="text-[10px] font-bold tracking-[.16em] text-slate-400">FP&A WORKSPACE</p><p className="mt-1 text-sm font-bold">مساحة العمل</p><p className="mt-1 text-xs text-slate-400">المتاح لك: {enabledCount} من {totalCount}</p></div><nav>{navigation.map(([section,items])=><section key={section} className="mb-4"><h2 className="px-3 pb-1 pt-2 text-[10px] font-bold tracking-wide text-slate-400">{section}</h2>{items.map(item=><NavLink key={item[2]} item={item} allowed={allowed} pathname={pathname}/>)}</section>)}</nav></aside>}
