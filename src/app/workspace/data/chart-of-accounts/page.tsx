"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Row = Record<string, unknown>;
type Account = { id:string; code:string; name:string; parent_account_id:string|null; account_type:string|null; statement_type:string|null; statement_section:string|null; normal_balance:string; is_contra:boolean; is_active?:boolean };
type ImportRow = { row_number:number; account_code:string; account_name:string; parent_account_code:string|null; account_type:string|null; statement_classification:string|null; normal_balance:string|null; is_contra:boolean; is_active:boolean; validation_status:string; validation_errors:unknown };
type BatchMeta = { id:string; organization_id:string; file_name:string; status:string; row_count:number; accepted_count:number; rejected_count:number; error_count:number; warning_count:number; applied_at:string|null; applied_by:string|null };
type BatchResponse = { batch:BatchMeta; rows:ImportRow[] };

const required=["كود الحساب","اسم الحساب"];
const optional=["الحساب الأب","نوع الحساب","تصنيف القائمة","طبيعة الرصيد","حساب مقابل","نشط"];
const aliases:Record<string,string[]>={
  "كود الحساب":["كود الحساب","رقم الحساب","account_code","account code","account no","gl code"],
  "اسم الحساب":["اسم الحساب","account_name","account name","gl name"],
  "الحساب الأب":["الحساب الأب","parent_account_code","parent account code","parent account"],
  "نوع الحساب":["نوع الحساب","account_type","account type"],
  "تصنيف القائمة":["تصنيف القائمة","statement_classification","statement classification"],
  "طبيعة الرصيد":["طبيعة الرصيد","normal_balance","normal balance"],
  "حساب مقابل":["حساب مقابل","is_contra","contra account","is contra"],
  "نشط":["نشط","is_active","active","is active"]
};
const norm=(v:unknown)=>String(v??"").trim().toLowerCase().replace(/\s+/g," ");
const mapHeaders=(headers:string[])=>Object.fromEntries([...required,...optional].map(k=>[k,headers.find(h=>aliases[k].some(a=>norm(a)===norm(h)))||""]));
const truthy=(v:unknown,fallback:boolean)=>v==null||v===""?fallback:[true,1,"1","true","yes","نعم","نشط"].includes(typeof v==="string"?norm(v):v as never);

export default function ChartOfAccountsPage(){
  const supabase=getSupabaseBrowserClient();
  const [organizationId,setOrganizationId]=useState<string|null>(null);
  const [file,setFile]=useState<File|null>(null);
  const [rows,setRows]=useState<Row[]>([]);
  const [headers,setHeaders]=useState<string[]>([]);
  const [batch,setBatch]=useState<BatchResponse|null>(null);
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  const [search,setSearch]=useState("");
  const [expanded,setExpanded]=useState<Set<string>>(new Set());

  useEffect(()=>{const id=window.sessionStorage.getItem("activeOrganizationId")||window.localStorage.getItem("activeOrganizationId");setOrganizationId(id);},[]);

  const loadAccounts=useCallback(async(id:string)=>{
    const {data,error:e}=await supabase.rpc("get_chart_of_accounts",{p_organization_id:id});
    if(e)throw e; setAccounts((data??[]) as Account[]);
  },[supabase]);

  const loadBatch=useCallback(async(id:string)=>{
    const {data,error:e}=await supabase.rpc("get_account_import_batch",{p_batch_id:id});
    if(e)throw e;
    const r=data as BatchResponse;
    setBatch(r);
  },[supabase]);

  const loadPending=useCallback(async(id:string)=>{
    const {data,error:e}=await supabase.rpc("get_pending_account_import_batch",{p_organization_id:id});
    if(e)throw e;
    if(data) setBatch(data as BatchResponse);
  },[supabase]);

  useEffect(()=>{if(!organizationId)return; Promise.all([loadAccounts(organizationId),loadPending(organizationId)]).catch(e=>setError(e instanceof Error?e.message:"تعذر تحميل دليل الحسابات"));},[organizationId,loadAccounts,loadPending]);

  async function read(f:File){
    setFile(f);setRows([]);setHeaders([]);setBatch(null);setError("");
    try{
      if(f.size>20*1024*1024)throw Error("حجم الملف يتجاوز 20MB");
      const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});
      const sheet=wb.Sheets[wb.SheetNames[0]]; if(!sheet)throw Error("لم يتم العثور على ورقة بيانات");
      const parsed=XLSX.utils.sheet_to_json<Row>(sheet,{defval:""}); if(!parsed.length)throw Error("الملف لا يحتوي على بيانات");
      setRows(parsed);setHeaders(Object.keys(parsed[0]));
    }catch(e){setError(e instanceof Error?e.message:"تعذر قراءة الملف");}
  }

  const mapping=useMemo(()=>mapHeaders(headers),[headers]);
  const missing=required.filter(k=>!mapping[k]);

  async function createBatch(){
    if(!organizationId||!file||!rows.length||missing.length)return;
    setSaving(true);setError("");
    try{
      const payload=rows.map(r=>({
        account_code:String(r[mapping["كود الحساب"]]??"").trim(),
        account_name:String(r[mapping["اسم الحساب"]]??"").trim(),
        parent_account_code:mapping["الحساب الأب"]?String(r[mapping["الحساب الأب"]]??"").trim()||null:null,
        account_type:mapping["نوع الحساب"]?String(r[mapping["نوع الحساب"]]??"").trim()||null:null,
        statement_classification:mapping["تصنيف القائمة"]?String(r[mapping["تصنيف القائمة"]]??"").trim()||null:null,
        normal_balance:mapping["طبيعة الرصيد"]?String(r[mapping["طبيعة الرصيد"]]??"").trim()||null:null,
        is_contra:mapping["حساب مقابل"]?truthy(r[mapping["حساب مقابل"]],false):false,
        is_active:mapping["نشط"]?truthy(r[mapping["نشط"]],true):true
      }));
      const {data,error:e}=await supabase.rpc("create_account_import_batch",{p_organization_id:organizationId,p_file_name:file.name,p_file_hash:null,p_rows:payload});
      if(e)throw e;
      await loadBatch(String(data));
    }catch(e){setError(e instanceof Error?e.message:"تعذر إنشاء عملية الاستيراد");}
    finally{setSaving(false);}
  }

  async function applyBatch(){
    if(!batch||batch.batch.status!=="validated"||batch.batch.error_count!==0)return;
    setSaving(true);setError("");
    try{const {error:e}=await supabase.rpc("apply_account_import_batch",{p_batch_id:batch.batch.id});if(e)throw e;await loadBatch(batch.batch.id);await loadAccounts(batch.batch.organization_id);}
    catch(e){setError(e instanceof Error?e.message:"تعذر اعتماد دليل الحسابات");}
    finally{setSaving(false);}
  }

  function template(){
    const d=[
      {"كود الحساب":"1","اسم الحساب":"الأصول","الحساب الأب":"","نوع الحساب":"asset","تصنيف القائمة":"balance_sheet","طبيعة الرصيد":"debit","حساب مقابل":false,"نشط":true},
      {"كود الحساب":"11","اسم الحساب":"الأصول المتداولة","الحساب الأب":"1","نوع الحساب":"asset","تصنيف القائمة":"balance_sheet","طبيعة الرصيد":"debit","حساب مقابل":false,"نشط":true},
      {"كود الحساب":"1101","اسم الحساب":"النقدية والبنوك","الحساب الأب":"11","نوع الحساب":"asset","تصنيف القائمة":"balance_sheet","طبيعة الرصيد":"debit","حساب مقابل":false,"نشط":true}
    ];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(d),"دليل الحسابات");XLSX.writeFile(wb,"FPA-chart-of-accounts-template.xlsx");
  }

  const filtered=useMemo(()=>{const q=norm(search);return accounts.filter(a=>!q||norm(`${a.code} ${a.name}`).includes(q));},[accounts,search]);
  const children=useMemo(()=>{const m=new Map<string|null,Account[]>();for(const a of filtered)m.set(a.parent_account_id,[...(m.get(a.parent_account_id)||[]),a]);return m;},[filtered]);
  const renderTree=(parent:string|null,level=1):React.ReactNode=>level>6?null:(children.get(parent)||[]).map(a=>{const has=!!children.get(a.id)?.length;const open=expanded.has(a.id)||!!search;return <div key={a.id}><div className="flex items-center gap-2 border-b px-3 py-3" style={{paddingRight:12+(level-1)*28}}>{has?<button className="h-7 w-7 rounded border" onClick={()=>setExpanded(s=>{const n=new Set(s);n.has(a.id)?n.delete(a.id):n.add(a.id);return n;})}>{open?"−":"+"}</button>:<span className="w-7"/>}<span className="w-10 text-[10px] text-slate-400">L{level}</span><span className="w-28 font-mono text-xs font-bold">{a.code}</span><span className="font-semibold">{a.name}</span>{a.account_type&&<span className="mr-auto rounded bg-slate-100 px-2 py-1 text-[10px]">{a.account_type}</span>}</div>{has&&open&&renderTree(a.id,level+1)}</div>});

  return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-slate-900"><header className="border-b bg-white"><div className="mx-auto flex max-w-7xl justify-between px-4 py-5"><a href="/workspace/data" className="text-sm text-slate-500">العودة للبيانات والاستيرادات</a><div><p className="text-[10px] font-bold tracking-widest text-slate-400">CHART OF ACCOUNTS</p><h1 className="text-xl font-bold">دليل الحسابات</h1></div></div></header><section className="mx-auto max-w-7xl px-4 py-7">
    <div className="border-b pb-6"><h2 className="text-3xl font-bold">دليل الحسابات هو الأساس المالي للنموذج</h2><p className="mt-3 text-sm leading-7 text-slate-500">يدعم الإدخال اليدوي وExcel/CSV والتكاملات، مع تسلسل هرمي حتى 6 مستويات. الحسابات المعتمدة هنا تصبح أهداف Mapping.</p></div>
    {error&&<div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]"><section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-bold">استيراد دليل الحسابات</h3><p className="mt-1 text-xs text-slate-500">الحقول المطلوبة: كود الحساب واسم الحساب</p></div><button onClick={template} className="rounded-xl border px-4 py-2 text-xs font-bold">تنزيل القالب</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[...required,...optional].map(x=><div key={x} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">{required.includes(x)?"*":"•"} {x}</div>)}</div><input type="file" accept=".xlsx,.xls,.csv" onChange={e=>e.target.files?.[0]&&read(e.target.files[0])} className="mt-5 block w-full text-sm"/>{rows.length>0&&<><div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">تم اكتشاف <b>{rows.length}</b> صفًا {missing.length?<span className="text-red-700"> — الحقول المفقودة: {missing.join("، ")}</span>:<span className="text-emerald-700"> — الحقول الأساسية مكتملة</span>}</div><div className="mt-4 overflow-auto"><table className="min-w-full text-xs"><thead><tr className="border-b">{headers.map(h=><th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody>{rows.slice(0,8).map((r,i)=><tr key={i} className="border-b">{headers.map(h=><td key={h} className="px-3 py-2">{String(r[h]??"")}</td>)}</tr>)}</tbody></table></div><button disabled={!!missing.length||saving} onClick={createBatch} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{saving?"جارٍ إنشاء العملية…":"التحقق وإنشاء عملية للمراجعة"}</button></>}</section><aside className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="font-bold">دورة الاعتماد</h3><div className="mt-4 space-y-3 text-sm"><div className="rounded-xl bg-slate-50 p-3">1. الاستيراد</div><div className="rounded-xl bg-slate-50 p-3">2. التحقق والمراجعة</div><div className="rounded-xl bg-slate-50 p-3">3. الاعتماد وإدخال الحسابات</div><div className="rounded-xl bg-slate-50 p-3">4. ظهور الحسابات في Mapping</div></div></aside></div>
    {batch&&<section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold text-slate-400">IMPORT REVIEW</p><h3 className="mt-1 text-xl font-bold">مراجعة {batch.batch.file_name}</h3><p className="mt-2 text-xs text-slate-500">رقم العملية: <span className="font-mono">{batch.batch.id}</span></p></div><span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">{batch.batch.status==="validated"?"جاهزة للاعتماد":batch.batch.status}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3">الصفوف <b className="block">{batch.batch.row_count}</b></div><div className="rounded-xl bg-slate-50 p-3">مقبولة <b className="block">{batch.batch.accepted_count}</b></div><div className="rounded-xl bg-slate-50 p-3">أخطاء <b className="block">{batch.batch.error_count}</b></div><div className="rounded-xl bg-slate-50 p-3">تحذيرات <b className="block">{batch.batch.warning_count}</b></div></div><div className="mt-5 overflow-auto"><table className="min-w-[900px] w-full text-right text-xs"><thead className="bg-slate-50"><tr><th className="p-3">#</th><th className="p-3">الكود</th><th className="p-3">الحساب</th><th className="p-3">الأب</th><th className="p-3">النوع</th><th className="p-3">الحالة</th></tr></thead><tbody>{batch.rows.map(r=><tr key={r.row_number} className="border-t"><td className="p-3">{r.row_number}</td><td className="p-3 font-mono font-bold">{r.account_code}</td><td className="p-3 font-semibold">{r.account_name}</td><td className="p-3">{r.parent_account_code||"—"}</td><td className="p-3">{r.account_type||"—"}</td><td className="p-3">{r.validation_status}</td></tr>)}</tbody></table></div>{batch.batch.status==="validated"&&batch.batch.error_count===0&&<div className="mt-5 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><b className="text-emerald-800">العملية جاهزة للاعتماد</b><p className="mt-1 text-xs text-emerald-700">لن تدخل الحسابات إلى الدليل قبل تنفيذ الاعتماد.</p></div><button disabled={saving} onClick={applyBatch} className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white disabled:opacity-40">{saving?"جارٍ الاعتماد…":"تأكيد واعتماد دليل الحسابات"}</button></div>}{batch.batch.status==="applied"&&<div className="mt-5 rounded-xl bg-emerald-50 p-4 font-bold text-emerald-800">تم اعتماد العملية وإدخال الحسابات إلى دليل الحسابات.</div>}</section>}
    <section className="mt-6 rounded-2xl border bg-white shadow-sm"><div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-bold">شجرة دليل الحسابات</h3><p className="mt-1 text-xs text-slate-500">المستويات المدعومة من 1 إلى 6</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالكود أو اسم الحساب" className="w-full rounded-xl border px-4 py-3 text-sm sm:w-72"/></div><div className="p-2">{accounts.length?renderTree(null):<div className="p-10 text-center text-sm text-slate-500">لا توجد حسابات معتمدة حاليًا.</div>}</div></section>
  </section></main>;
}
