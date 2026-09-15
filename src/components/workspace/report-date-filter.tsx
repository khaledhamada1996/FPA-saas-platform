"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type DateRange = { start: string; end: string };
type Props = { value: DateRange; onChange: (value: DateRange) => void; minDate?: string; maxDate?: string };

const pad = (n: number) => String(n).padStart(2, "0");
const localIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (value: string) => { const [y,m,d] = value.split("-").map(Number); return new Date(y,m-1,d); };
const addDays = (d: Date, days: number) => { const r = new Date(d.getFullYear(),d.getMonth(),d.getDate()); r.setDate(r.getDate()+days); return r; };
const startOfWeek = (d: Date) => addDays(d,-((d.getDay()+6)%7));
const endOfWeek = (d: Date) => addDays(startOfWeek(d),6);
const startOfMonth = (d: Date) => new Date(d.getFullYear(),d.getMonth(),1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(),d.getMonth()+1,0);
const startOfQuarter = (d: Date) => new Date(d.getFullYear(),Math.floor(d.getMonth()/3)*3,1);
const endOfQuarter = (d: Date) => new Date(d.getFullYear(),Math.floor(d.getMonth()/3)*3+3,0);
const startOfYear = (d: Date) => new Date(d.getFullYear(),0,1);
const endOfYear = (d: Date) => new Date(d.getFullYear(),11,31);
function clampRange(range: DateRange,minDate?:string,maxDate?:string):DateRange { let {start,end}=range; if(minDate&&start<minDate)start=minDate; if(maxDate&&end>maxDate)end=maxDate; if(start>end)end=start; return {start,end}; }

export function ReportDateFilter({value,onChange,minDate,maxDate}:Props){
 const [open,setOpen]=useState(false); const [loadingAll,setLoadingAll]=useState(false); const ref=useRef<HTMLDivElement>(null); const today=useMemo(()=>new Date(),[]); const anchor=value.end?fromIso(value.end):today;
 useEffect(()=>{ if(!open)return; const onPointerDown=(event:PointerEvent)=>{ if(ref.current&&!ref.current.contains(event.target as Node))setOpen(false); }; const onKeyDown=(event:KeyboardEvent)=>{ if(event.key==="Escape")setOpen(false); }; document.addEventListener("pointerdown",onPointerDown); document.addEventListener("keydown",onKeyDown); return()=>{document.removeEventListener("pointerdown",onPointerDown);document.removeEventListener("keydown",onKeyDown);}; },[open]);
 const label=value.start&&value.end?`${value.start} — ${value.end}`:"اختر الفترة";
 const apply=(start:Date,end:Date)=>{onChange(clampRange({start:localIso(start),end:localIso(end)},minDate,maxDate));setOpen(false);};
 const all=async()=>{setLoadingAll(true);try{if(minDate&&maxDate){onChange({start:minDate,end:maxDate});return;}const supabase=getSupabaseBrowserClient();const organizationId=typeof window!=="undefined"?window.sessionStorage.getItem("activeOrganizationId"):null;if(!organizationId){onChange({start:"",end:""});return;}const{data,error}=await supabase.rpc("get_financial_data_date_range",{p_organization_id:organizationId});if(error||!data?.min_date||!data?.max_date){onChange({start:"",end:""});return;}onChange({start:String(data.min_date).slice(0,10),end:String(data.max_date).slice(0,10)});}finally{setLoadingAll(false);setOpen(false);}};
 return <div ref={ref} className="relative"><button type="button" onClick={()=>setOpen(v=>!v)} className="min-h-9 border border-slate-300 bg-white px-3 text-xs font-bold">الفترة: {label}⌄</button>{open&&<div className="absolute right-0 top-10 z-50 w-[min(92vw,360px)] border border-slate-300 bg-white shadow-xl"><div className="border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-700">الفترة الزمنية</div>
 <button type="button" onClick={()=>apply(today,today)} className="block w-full border-b px-4 py-3 text-right text-xs">حتى اليوم</button>
 <button type="button" onClick={()=>apply(addDays(today,-1),addDays(today,-1))} className="block w-full border-b px-4 py-3 text-right text-xs">أمس</button>
 <button type="button" onClick={()=>apply(startOfWeek(today),endOfWeek(today))} className="block w-full border-b px-4 py-3 text-right text-xs">هذا الأسبوع</button>
 <button type="button" onClick={()=>{const e=addDays(startOfWeek(today),-1);apply(startOfWeek(e),e);}} className="block w-full border-b px-4 py-3 text-right text-xs">الأسبوع السابق</button>
 <button type="button" onClick={()=>apply(startOfMonth(anchor),endOfMonth(anchor))} className="block w-full border-b px-4 py-3 text-right text-xs">هذا الشهر</button>
 <button type="button" onClick={()=>{const d=new Date(anchor.getFullYear(),anchor.getMonth()-1,1);apply(startOfMonth(d),endOfMonth(d));}} className="block w-full border-b px-4 py-3 text-right text-xs">الشهر السابق</button>
 <button type="button" onClick={()=>apply(startOfQuarter(anchor),endOfQuarter(anchor))} className="block w-full border-b px-4 py-3 text-right text-xs">هذا الربع</button>
 <button type="button" onClick={()=>{const d=new Date(anchor.getFullYear(),Math.floor(anchor.getMonth()/3)*3-3,1);apply(startOfQuarter(d),endOfQuarter(d));}} className="block w-full border-b px-4 py-3 text-right text-xs">الربع السابق</button>
 <button type="button" onClick={()=>apply(startOfYear(anchor),endOfYear(anchor))} className="block w-full border-b px-4 py-3 text-right text-xs">هذه السنة</button>
 <button type="button" onClick={()=>{const y=anchor.getFullYear()-1;apply(new Date(y,0,1),new Date(y,11,31));}} className="block w-full border-b px-4 py-3 text-right text-xs">السنة السابقة</button>
 <button type="button" disabled={loadingAll} onClick={()=>void all()} className="block w-full border-b px-4 py-3 text-right text-xs font-bold disabled:opacity-50">{loadingAll?"جارٍ تحديد نطاق البيانات…":"كل البيانات"}</button>
 <div className="bg-slate-50 p-3"><div className="mb-2 text-[11px] font-bold">تاريخ مخصص</div><div className="grid gap-2"><input type="date" value={value.start} min={minDate} max={value.end||maxDate} onChange={e=>onChange({...value,start:e.target.value})} className="min-h-9 border bg-white px-2 text-xs"/><input type="date" value={value.end} min={value.start||minDate} max={maxDate} onChange={e=>onChange({...value,end:e.target.value})} className="min-h-9 border bg-white px-2 text-xs"/><button type="button" onClick={()=>setOpen(false)} className="min-h-9 bg-slate-950 text-xs font-bold text-white">تطبيق</button></div></div></div>}</div>;
}
