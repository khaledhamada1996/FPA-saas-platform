"use client";

import { ChangeEvent, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import "./import.css";
import { createClient } from "@/lib/supabase/client";

type Row = Record<string, string>;
type Mapping = Record<string, string>;
type MasterItem = { id: string; code: string; name: string };
type MasterData = Record<string, MasterItem[]>;

const fields = [
  { key: "date", label: "التاريخ", required: true }, { key: "account", label: "الحساب", required: true }, { key: "amount", label: "المبلغ", required: true },
  { key: "legal_entity", label: "الكيان القانوني", required: false }, { key: "branch", label: "الفرع", required: false }, { key: "department", label: "الإدارة", required: false },
  { key: "cost_center", label: "مركز التكلفة", required: false }, { key: "region", label: "المنطقة", required: false }, { key: "product", label: "المنتج", required: false }, { key: "project", label: "المشروع", required: false },
];
const masterTables: Record<string,string> = { account:"accounts", legal_entity:"legal_entities", branch:"branches", department:"departments", cost_center:"cost_centers", region:"regions", product:"products", project:"projects" };
const aliases: Record<string,string[]> = {
  date:["date","transaction_date","posting_date","تاريخ","التاريخ"], account:["account","account_code","account_name","الحساب","كود الحساب","اسم الحساب"], amount:["amount","value","balance","المبلغ","القيمة"],
  legal_entity:["legal_entity","entity","الكيان","الكيان القانوني"], branch:["branch","branch_name","الفرع"], department:["department","dept","الإدارة"], cost_center:["cost_center","cost centre","مركز التكلفة"], region:["region","المنطقة"], product:["product","المنتج"], project:["project","المشروع"]
};

function text(v: unknown) { return v == null ? "" : String(v).trim(); }
function numberValue(v: string) { return Number(v.replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\s/g,"").replace(/,/g,"").replace(/^\((.*)\)$/,"-$1")); }
function guess(headers:string[]):Mapping { const m:Mapping={}; fields.forEach(f=>{const h=headers.find(x=>aliases[f.key]?.includes(x)); if(h)m[f.key]=h;}); return m; }

export default function ActualsImportPage(){
  const [fileName,setFileName]=useState(""); const [headers,setHeaders]=useState<string[]>([]); const [rows,setRows]=useState<Row[]>([]); const [mapping,setMapping]=useState<Mapping>({});
  const [error,setError]=useState(""); const [stage,setStage]=useState<1|2|3|4>(1); const [loading,setLoading]=useState(false); const [publishing,setPublishing]=useState(false);
  const [masters,setMasters]=useState<MasterData>({}); const [maps,setMaps]=useState<Record<string,Record<string,string>>>({}); const [done,setDone]=useState<{id:string,count:number}|null>(null);

  const validation=useMemo(()=>{const errors:string[]=[]; const missing=["date","account","amount"].filter(k=>!mapping[k]); if(missing.length)errors.push(`يجب ربط الحقول الأساسية: ${missing.join("، ")}`); rows.forEach((r,i)=>{if(!mapping.date||!r[mapping.date])errors.push(`الصف ${i+2}: التاريخ مفقود`);if(!mapping.account||!r[mapping.account])errors.push(`الصف ${i+2}: الحساب مفقود`);if(!mapping.amount||!Number.isFinite(numberValue(r[mapping.amount]||"")))errors.push(`الصف ${i+2}: المبلغ غير صالح`);});return {valid:rows.length>0&&errors.length===0,errors};},[rows,mapping]);
  const sourceValues=useMemo(()=>{const out:Record<string,string[]>={};fields.forEach(f=>{if(mapping[f.key])out[f.key]=Array.from(new Set(rows.map(r=>text(r[mapping[f.key]])).filter(Boolean)));});return out;},[rows,mapping]);
  const mappingValid=["date","account","amount"].every(k=>!!mapping[k]);
  const valuesValid=fields.every(f=>{const vals=sourceValues[f.key]||[];return vals.every(v=>!!maps[f.key]?.[v]);});

  async function handleFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file)return; setError("");setDone(null);setRows([]);setHeaders([]);setMapping({});setMasters({});setMaps({});setStage(1);setFileName(file.name);
    if(!/\.xlsx?$/i.test(file.name)){setError("يرجى رفع ملف Excel بصيغة XLSX أو XLS.");return;}
    try{const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true}); const sheet=wb.Sheets[wb.SheetNames[0]]; if(!sheet)throw new Error("ملف Excel لا يحتوي على ورقة بيانات."); const data=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:""}); if(!data.length)throw new Error("ورقة Excel فارغة."); const hs=Object.keys(data[0]).map(text).filter(Boolean); const rs=data.map(r=>Object.fromEntries(hs.map(h=>[h,text(r[h])]))); setHeaders(hs);setRows(rs);setMapping(guess(hs));setStage(2);}catch(err){setError(err instanceof Error?err.message:"تعذر قراءة ملف Excel.");}
  }

  async function loadMasters(){setError("");setLoading(true);try{const s=createClient();const {data:mem,error:me}=await s.from("organization_members").select("organization_id").limit(1).maybeSingle();if(me||!mem?.organization_id)throw new Error("تعذر تحديد مساحة العمل الحالية.");const next:MasterData={};for(const f of fields){if(!mapping[f.key]||!(sourceValues[f.key]||[]).length)continue;const table=masterTables[f.key];const {data,error}=await s.from(table).select("id,code,name").eq("organization_id",mem.organization_id).order("code");if(error)throw new Error(`تعذر تحميل ${f.label}: ${error.message}`);next[f.key]=(data||[]) as MasterItem[];}const auto:Record<string,Record<string,string>>={};for(const f of fields){auto[f.key]={};for(const v of sourceValues[f.key]||[]){const hit=(next[f.key]||[]).find(x=>x.code===v||x.name===v);if(hit)auto[f.key][v]=hit.code;}}setMasters(next);setMaps(auto);setStage(3);}catch(err){setError(err instanceof Error?err.message:"تعذر تحميل القيم المرجعية.");}finally{setLoading(false);}}
  function setMap(field:string,source:string,target:string){setMaps(x=>({...x,[field]:{...(x[field]||{}),[source]:target}}));}
  async function publish(){setError("");setPublishing(true);try{if(!valuesValid)throw new Error("يجب مطابقة كل قيمة مصدر مع قيمة معتمدة قبل النشر.");const s=createClient();const {data:mem,error:me}=await s.from("organization_members").select("organization_id").limit(1).maybeSingle();if(me||!mem?.organization_id)throw new Error("يجب تسجيل الدخول قبل النشر.");const payload=rows.map((r,i)=>{const p:Record<string,string|number>={date:r[mapping.date]||"",account:maps.account?.[r[mapping.account]||""]||"",amount:numberValue(r[mapping.amount]||""),source_row:i+2};for(const k of Object.keys(masterTables).filter(x=>x!=="account")){const v=text(mapping[k]?r[mapping[k]]:"");if(v)p[k]=maps[k]?.[v]||"";}return p;});const {data,error}=await s.rpc("publish_actual_import",{target_organization_id:mem.organization_id,target_file_name:fileName,target_rows:payload});if(error)throw new Error(error.message);if(!data?.batch_id)throw new Error("لم يرجع محرك الاستيراد رقم الدفعة.");setDone({id:data.batch_id,count:data.row_count});setStage(4);}catch(err){setError(err instanceof Error?err.message:"تعذر نشر البيانات. لم يتم اعتماد أي صف.");}finally{setPublishing(false);}}

  return <main className="import-page" dir="rtl"><header className="import-topbar"><div><p>منصة القائد / البيانات الفعلية</p><h1>إدخال البيانات الفعلية</h1></div><a href="/dashboard">العودة للوحة الإدارة</a></header><section className="import-card">
    <section className="validation-section"><div className="section-title"><div><h2>3 طرق معتمدة لإدخال البيانات</h2><p>Excel هو المسار الأساسي للشركات الصغيرة والمتوسطة مع نفس محرك التحقق المستخدم في كل مصادر البيانات</p></div></div><div className="mapping-grid">
      <div className="value-map-block"><div className="value-map-title"><strong>Excel</strong><span>الأساسي</span></div><p>رفع ملف XLSX أو XLS مع مطابقة الأعمدة والقيم قبل النشر.</p><label className="upload-button">اختيار ملف Excel<input type="file" accept=".xlsx,.xls" onChange={handleFile}/></label></div>
      <div className="value-map-block"><div className="value-map-title"><strong>إدخال يدوي</strong></div><p>إدخال مباشر مضبوط من القيم المرجعية.</p><a className="primary-action" href="/dashboard/import/manual">فتح الإدخال اليدوي</a></div>
      <div className="value-map-block"><div className="value-map-title"><strong>Integration</strong><span>للشركات الكبيرة</span></div><p>ربط الأنظمة المحاسبية عبر طبقة تكامل موحدة.</p><a className="primary-action" href="/dashboard/import/integrations">إدارة التكاملات</a></div>
    </div></section>
    <div className="mapping-note"><strong>قاعدة الدقة</strong><span>لا يتم اعتماد أي رقم مباشرة من Excel أو الإدخال اليدوي أو التكامل. كل مصدر يمر بالتحقق ثم مطابقة القيم ثم فحص قاعدة البيانات.</span></div>
    {fileName&&<div className="file-row"><strong>{fileName}</strong><span>{rows.length} صف</span></div>}{error&&<div className="message error">{error}</div>}
    {rows.length>0&&<><section className="validation-section"><div className="section-title"><div><h2>التحقق الأولي</h2><p>فحص الحقول الأساسية قبل أي مطابقة</p></div><strong className={validation.valid?"valid":"invalid"}>{validation.valid?"صالح":`${validation.errors.length} مشكلة`}</strong></div>{!validation.valid&&<div className="errors">{validation.errors.slice(0,20).map(x=><div key={x}>{x}</div>)}</div>}<div className="preview"><div className="preview-head">{headers.map(h=><span key={h}>{h}</span>)}</div>{rows.slice(0,8).map((r,i)=><div className="preview-row" key={i}>{headers.map(h=><span key={h}>{r[h]||"—"}</span>)}</div>)}</div></section>
    {validation.valid&&<section className="validation-section"><div className="section-title"><div><h2>مطابقة الأعمدة</h2><p>حدد معنى كل عمود في ملف Excel</p></div></div><div className="mapping-grid">{fields.map(f=><label className="mapping-row" key={f.key}><span>{f.label}{f.required?" *":""}</span><select value={mapping[f.key]||""} onChange={e=>setMapping(x=>({...x,[f.key]:e.target.value}))}><option value="">غير مربوط</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}</select></label>)}</div><button className="primary-action" disabled={!mappingValid||loading} onClick={loadMasters}>{loading?"جارٍ تحميل القيم...":"مراجعة القيم ومطابقتها"}</button></section>}
    {stage===3&&<section className="validation-section"><div className="section-title"><div><h2>مطابقة القيم</h2><p>كل قيمة مصدر يجب أن تقابل قيمة معتمدة</p></div><strong className={valuesValid?"valid":"invalid"}>{valuesValid?"جاهز":"تحتاج مطابقة"}</strong></div>{fields.map(f=>(sourceValues[f.key]||[]).length?<div className="value-map-block" key={f.key}><div className="value-map-title"><strong>{f.label}</strong><span>{sourceValues[f.key].length} قيمة</span></div>{sourceValues[f.key].map(v=><label className="mapping-row" key={v}><span>{v}</span><select value={maps[f.key]?.[v]||""} onChange={e=>setMap(f.key,v,e.target.value)}><option value="">اختر القيمة المعتمدة</option>{(masters[f.key]||[]).map(m=><option key={m.id} value={m.code}>{m.code} — {m.name}</option>)}</select></label>)}</div>:null)}<button className="primary-action" disabled={!valuesValid} onClick={()=>setStage(4)}>اعتماد المطابقة</button></section>}
    {stage===4&&!done&&<section className="validation-section"><div className="next-note">سيتم إرسال {rows.length} صف إلى محرك النشر الذري والتحقق داخل قاعدة البيانات مرة أخرى.</div><button className="primary-action" disabled={!valuesValid||publishing} onClick={publish}>{publishing?"جارٍ النشر...":"نشر البيانات الفعلية"}</button></section>}{done&&<section className="validation-section"><div className="section-title"><div><h2>تم اعتماد البيانات</h2><p>تم نشر الدفعة بعد نجاح التحقق</p></div><strong className="valid">Published</strong></div><div className="next-note">رقم الدفعة: {done.id}<br/>عدد الصفوف: {done.count}</div><a className="primary-action" href="/dashboard">فتح لوحة الإدارة</a></section>}</>}
  </section></main>;
}
