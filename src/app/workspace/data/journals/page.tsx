"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Journal={journal_no:string;transaction_date:string;description:string;debit_minor:number;credit_minor:number;line_count:number;version_no:number};
const money=(v:number)=> (v/100).toLocaleString("ar-SA",{minimumFractionDigits:2,maximumFractionDigits:2});
export default function JournalsPage(){
 const [rows,setRows]=useState<Journal[]>([]); const [q,setQ]=useState(""); const [start,setStart]=useState(""); const [end,setEnd]=useState(""); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [total,setTotal]=useState(0);
 const load=async()=>{setLoading(true);setError(""); const id=window.sessionStorage.getItem("activeOrganizationId"); if(!id){setError("لم يتم تحديد الشركة النشطة");setLoading(false);return}
  const {data,error}=await getSupabaseBrowserClient().rpc("get_journal_entries",{p_organization_id:id,p_start_date:start||null,p_end_date:end||null,p_journal_no:q||null,p_limit:100,p_offset:0});
  if(error){setError(error.message);setRows([])} else {setRows((data?.rows??[]) as Journal[]);setTotal(Number(data?.total??0))} setLoading(false);
 };
 useEffect(()=>{void load()},[]);
 const balanced=useMemo(()=>rows.filter(r=>r.debit_minor===r.credit_minor).length,[rows]);
 return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-slate-900">
  <header className="border-b border-slate-200 bg-white"><div className="px-4 py-5 sm:px-6 lg:px-8"><Link href="/workspace/data" className="text-xs text-slate-500">مركز البيانات</Link><div className="mt-1 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[0.16em] text-slate-400">JOURNAL ENTRIES</p><h1 className="text-2xl font-bold text-slate-950">قيود اليومية</h1><p className="mt-1 text-sm text-slate-500">عرض القيود الفعلية المنشورة وفتح القيد لمراجعته أو تعديله بإصدار جديد.</p></div><Link href="/workspace/data/manual" className="bg-slate-950 px-4 py-2.5 text-xs font-bold text-white">+ إضافة قيد</Link></div></div></header>
  <section className="px-4 py-6 sm:px-6 lg:px-8">
   <div className="border border-slate-200 bg-white p-4"><div className="grid gap-3 md:grid-cols-4"><label className="text-xs font-bold text-slate-600">رقم القيد<input value={q} onChange={e=>setQ(e.target.value)} className="mt-1 h-10 w-full border border-slate-300 px-3 font-normal outline-none"/></label><label className="text-xs font-bold text-slate-600">من<input type="date" value={start} onChange={e=>setStart(e.target.value)} className="mt-1 h-10 w-full border border-slate-300 px-3 font-normal"/></label><label className="text-xs font-bold text-slate-600">إلى<input type="date" value={end} onChange={e=>setEnd(e.target.value)} className="mt-1 h-10 w-full border border-slate-300 px-3 font-normal"/></label><div className="flex items-end"><button onClick={()=>void load()} className="h-10 w-full bg-slate-900 text-xs font-bold text-white">بحث</button></div></div></div>
   {error&&<div className="mt-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
   <div className="mt-4 border border-slate-200 bg-white"><div className="flex flex-wrap justify-between gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-500"><span>{total.toLocaleString("ar-SA")} قيد</span><span>المعروض المتوازن: {balanced.toLocaleString("ar-SA")}</span></div>
    <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-xs"><thead className="bg-slate-50"><tr>{["رقم القيد","التاريخ","البيان","عدد السطور","المدين","الدائن","الإصدار",""].map(h=><th key={h} className="border-b border-slate-200 px-4 py-3 text-right">{h}</th>)}</tr></thead><tbody>{loading?<tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">جارٍ التحميل…</td></tr>:rows.length===0?<tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">لا توجد قيود مطابقة للبحث.</td></tr>:rows.map(r=><tr key={r.journal_no} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 font-bold">{r.journal_no}</td><td className="px-4 py-3">{r.transaction_date}</td><td className="max-w-[300px] truncate px-4 py-3">{r.description||"—"}</td><td className="px-4 py-3">{r.line_count}</td><td className="px-4 py-3">{money(r.debit_minor)}</td><td className="px-4 py-3">{money(r.credit_minor)}</td><td className="px-4 py-3">v{r.version_no}</td><td className="px-4 py-3"><Link href={"/workspace/data/journals/"+encodeURIComponent(r.journal_no)} className="font-bold text-slate-700 underline underline-offset-4">فتح</Link></td></tr>)}</tbody></table></div>
   </div>
  </section>
 </main>
}
