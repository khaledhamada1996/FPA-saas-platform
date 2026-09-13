"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Source={id:string;source_type:string;system_name:string|null;status:string};
type Connector={id:string;connector_key:string;display_name:string;category:string;supported_source_type:string;auth_type:string;capabilities:Record<string,unknown>;supported_entities:string[];status:string};
type Attached={id:string;data_source_id:string;connector_id:string;connector_key:string;display_name:string;connection_ref:string|null;enabled:boolean;last_success_at:string|null;last_error_message:string|null};
const sourceLabels:Record<string,string>={manual:"يدوي",excel_csv:"Excel / CSV",integration:"تكامل",api:"API",database:"قاعدة بيانات",other:"أخرى"};
const statusLabels:Record<string,string>={available:"متاح",planned:"مخطط",disabled:"معطل"};
function fmt(v:string|null){return v?new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"—"}
export default function ConnectorsPage(){
 const supabase=getSupabaseBrowserClient();
 const [sources,setSources]=useState<Source[]>([]); const [catalog,setCatalog]=useState<Connector[]>([]); const [attached,setAttached]=useState<Attached[]>([]);
 const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [canManage,setCanManage]=useState(false);
 const [sourceId,setSourceId]=useState(""); const [connectorId,setConnectorId]=useState(""); const [connectionRef,setConnectionRef]=useState(""); const [busy,setBusy]=useState(false);
 async function load(){
  setLoading(true); setError("");
  const {data:userData}=await supabase.auth.getUser(); if(!userData.user){window.location.assign("/login?next=/workspace/data-monitoring/connectors");return}
  const org=window.sessionStorage.getItem("activeOrganizationId"); if(!org){window.location.assign("/start");return}
  const [{data:monitoring,error:monitoringError},{data:cat,error:catError},{data:links,error:linksError},{data:access}]=await Promise.all([
   supabase.rpc("get_data_monitoring",{p_organization_id:org}),
   supabase.rpc("get_connector_catalog",{p_organization_id:org}),
   supabase.rpc("get_data_source_connectors",{p_organization_id:org}),
   supabase.rpc("get_my_org_access",{p_organization_id:org})
  ]);
  const firstError=monitoringError||catError||linksError; if(firstError){setError(firstError.message);setLoading(false);return}
  setSources(monitoring?.sources??[]); setCatalog(cat??[]); setAttached(links??[]);
  setCanManage((access??[]).some((x:{permission_key?:string;granted?:boolean})=>x.permission_key==="connector.manage"&&x.granted===true));
  setLoading(false);
 }
 useEffect(()=>{void load()},[]);
 const selectedSource=sources.find(s=>s.id===sourceId); const compatible=useMemo(()=>catalog.filter(c=>c.status==="available"&&(!selectedSource||c.supported_source_type===selectedSource.source_type)),[catalog,selectedSource]);
 useEffect(()=>{if(connectorId&&!compatible.some(c=>c.id===connectorId))setConnectorId(compatible[0]?.id??"")},[compatible,connectorId]);
 async function attach(){
  const org=window.sessionStorage.getItem("activeOrganizationId"); if(!org||!sourceId||!connectorId)return;
  setBusy(true);setError("");setNotice("");
  const {error:e}=await supabase.rpc("attach_data_source_connector",{p_organization_id:org,p_data_source_id:sourceId,p_connector_id:connectorId,p_connection_ref:connectionRef.trim()||null,p_sync_config:{mode:"manual"}});
  if(e)setError(e.message); else {setNotice("تم ربط الموصل بمصدر البيانات");setConnectionRef("");await load()}
  setBusy(false);
 }
 return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-slate-900">
  <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8"><div><p className="text-[11px] font-bold tracking-[0.14em] text-slate-400">CONNECTOR MANAGEMENT</p><h1 className="mt-1 text-xl font-bold sm:text-2xl">إدارة موصلات البيانات</h1></div><Link href="/workspace/data-monitoring" className="border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">مراقبة البيانات</Link></div></header>
  <section className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
   <div className="mb-7"><h2 className="text-2xl font-bold tracking-tight">ربط مصادر المنشأة بالموصلات</h2><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">الموصل يحدد طريقة الاتصال ومجموعة البيانات التي يمكن جلبها. هذه المرحلة لا تنشئ اتصالًا خارجيًا تلقائيًا ولا تخزن أسرار المصادقة داخل قاعدة البيانات.</p></div>
   {notice&&<div className="mb-5 border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>}{error&&<div className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700">تعذر تنفيذ العملية: {error}</div>}
   {loading?<div className="border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">جارٍ تحميل الموصلات…</div>:<>
    {canManage&&<div className="border border-slate-200 bg-white p-5"><div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-semibold">مصدر البيانات<select value={sourceId} onChange={e=>setSourceId(e.target.value)} className="mt-2 w-full border border-slate-200 bg-white px-3 py-2.5"><option value="">اختر المصدر</option>{sources.map(s=><option key={s.id} value={s.id}>{s.system_name||"مصدر بدون اسم"} — {sourceLabels[s.source_type]??s.source_type}</option>)}</select></label><label className="text-sm font-semibold">الموصل<select value={connectorId} onChange={e=>setConnectorId(e.target.value)} disabled={!sourceId} className="mt-2 w-full border border-slate-200 bg-white px-3 py-2.5"><option value="">{sourceId?"اختر الموصل":"اختر المصدر أولًا"}</option>{compatible.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label><label className="text-sm font-semibold">مرجع الاتصال<input value={connectionRef} onChange={e=>setConnectionRef(e.target.value)} className="mt-2 w-full border border-slate-200 px-3 py-2.5" placeholder="مرجع خارجي اختياري — ليس سرًا"/></label></div><div className="mt-4 flex justify-end"><button disabled={busy||!sourceId||!connectorId} onClick={()=>void attach()} className="bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy?"جارٍ الربط…":"ربط الموصل"}</button></div></div>}
    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{catalog.map(c=><article key={c.id} className="border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{c.display_name}</h3><p className="mt-1 text-xs text-slate-400">{sourceLabels[c.supported_source_type]??c.supported_source_type} · {c.auth_type}</p></div><span className="text-xs font-bold text-slate-500">{statusLabels[c.status]??c.status}</span></div><p className="mt-4 text-sm leading-6 text-slate-500">الكيانات المدعومة: {c.supported_entities?.join("، ")||"—"}</p><p className="mt-2 text-xs text-slate-400">{Object.entries(c.capabilities??{}).filter(([,v])=>v===true).map(([k])=>k).join(" · ")||"لا توجد قدرات مفعلة"}</p></article>)}</div>
    <div className="mt-8 border border-slate-200 bg-white"><div className="border-b border-slate-200 px-5 py-4"><h3 className="font-bold">الموصلات المرتبطة حاليًا</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">الموصل</th><th className="px-5 py-3">مصدر البيانات</th><th className="px-5 py-3">الحالة</th><th className="px-5 py-3">آخر نجاح</th><th className="px-5 py-3">مرجع الاتصال</th></tr></thead><tbody className="divide-y divide-slate-100">{attached.length?attached.map(a=>{const s=sources.find(x=>x.id===a.data_source_id);return <tr key={a.id}><td className="px-5 py-4 font-semibold">{a.display_name}</td><td className="px-5 py-4">{s?.system_name||"—"}</td><td className="px-5 py-4">{a.enabled?"مفعّل":"متوقف"}</td><td className="px-5 py-4">{fmt(a.last_success_at)}</td><td className="px-5 py-4 text-slate-500">{a.connection_ref||"—"}</td></tr>}) : <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">لا توجد موصلات مرتبطة حتى الآن.</td></tr>}</tbody></table></div></div>
   </>}
  </section>
 </main>
}
