"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ImportType = "legal_entities" | "branches" | "departments" | "cost_centers" | "regions" | "products" | "projects";
type Row = Record<string, unknown>;
type Batch = { batch?: { id: string; input_type: string; file_name: string; status: string; row_count: number; accepted_count: number; rejected_count: number; error_count: number }; rows?: Array<{ row_number: number; validation_status: string; validation_errors: string[]; source_payload: Row }> };
type Field = { key: string; label: string; required?: boolean };

const TYPES: Array<{ key: ImportType; title: string; help: string; required: string[]; fields: Field[] }> = [
  { key: "legal_entities", title: "الكيانات القانونية", help: "الشركات والكيانات القانونية داخل المؤسسة", required: ["code", "name"], fields: [{key:"code",label:"الكود",required:true},{key:"name",label:"الاسم",required:true},{key:"currency",label:"العملة"}] },
  { key: "branches", title: "الفروع", help: "الفروع مع ربط كل فرع بكيانه القانوني", required: ["code", "name", "legal_entity_code"], fields: [{key:"code",label:"الكود",required:true},{key:"name",label:"الاسم",required:true},{key:"legal_entity_code",label:"كود الكيان القانوني",required:true},{key:"country",label:"الدولة"},{key:"city",label:"المدينة"},{key:"address",label:"العنوان"},{key:"branch_type",label:"نوع الفرع"},{key:"registration_number",label:"رقم السجل"},{key:"tax_id",label:"الرقم الضريبي"},{key:"contact_phone",label:"الهاتف"},{key:"contact_email",label:"البريد الإلكتروني"},{key:"manager_name",label:"اسم المدير"},{key:"is_active",label:"نشط"}] },
  { key: "departments", title: "الأقسام", help: "الأقسام التنظيمية المستخدمة في التخطيط والتحليل", required: ["code", "name"], fields: [{key:"code",label:"الكود",required:true},{key:"name",label:"الاسم",required:true}] },
  { key: "cost_centers", title: "مراكز التكلفة", help: "مراكز التكلفة للتحليل والرقابة", required: ["code", "name"], fields: [{key:"code",label:"الكود",required:true},{key:"name",label:"الاسم",required:true}] },
  { key: "regions", title: "المناطق", help: "المناطق الجغرافية", required: ["code", "name"], fields: [{key:"code",label:"الكود",required:true},{key:"name",label:"الاسم",required:true}] },
  { key: "products", title: "المنتجات", help: "المنتجات أو الخدمات", required: ["code", "name"], fields: [{key:"code",label:"الكود",required:true},{key:"name",label:"الاسم",required:true}] },
  { key: "projects", title: "المشروعات", help: "المشروعات ومجالات المتابعة", required: ["code", "name"], fields: [{key:"code",label:"الكود",required:true},{key:"name",label:"الاسم",required:true}] },
];
const normalize = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const value = (row: Row, field: string) => row[field] ?? "";

export default function MasterDataImportPage() {
  const [typeKey, setTypeKey] = useState<ImportType>("legal_entities");
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = useMemo(() => TYPES.find((x) => x.key === typeKey)!, [typeKey]);
  const mapping = useMemo(() => {
    const aliases: Record<string,string[]> = { code:["code","الكود"],name:["name","الاسم"],currency:["currency","العملة"],legal_entity_code:["legal_entity_code","legal entity code","كود الكيان القانوني"],country:["country","الدولة"],city:["city","المدينة"],address:["address","العنوان"],branch_type:["branch_type","branch type","نوع الفرع"],registration_number:["registration_number","registration number","رقم السجل"],tax_id:["tax_id","tax id","الرقم الضريبي"],contact_phone:["contact_phone","contact phone","الهاتف"],contact_email:["contact_email","contact email","البريد الإلكتروني"],manager_name:["manager_name","manager name","اسم المدير"],is_active:["is_active","active","نشط"] };
    const out: Record<string,string> = {};
    selected.fields.forEach((f) => { const h = headers.find((x) => (aliases[f.key] || [f.key]).some((a) => normalize(a) === normalize(x))); if (h) out[f.key] = h; });
    return out;
  }, [headers, selected]);
  const missing = selected.required.filter((f) => !mapping[f]);
  const invalidRows = batch?.rows?.filter((r) => r.validation_status === "error") ?? [];

  function reset(next: ImportType) { setTypeKey(next); setRows([]); setHeaders([]); setFileName(""); setBatch(null); setError(""); }

  function downloadTemplate() {
    const row: Row = {};
    selected.fields.forEach((f) => { row[f.key] = f.key === "currency" ? "SAR" : f.key === "is_active" ? "true" : ""; });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([row]), "Master Data");
    XLSX.writeFile(wb, `FPA-${typeKey}-template.xlsx`);
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setError(""); setBatch(null); setRows([]); setHeaders([]); setFileName(f.name);
    try {
      if (f.size > 20 * 1024 * 1024) throw new Error("حجم الملف يتجاوز 20MB");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]]; if (!sheet) throw new Error("لم يتم العثور على ورقة بيانات");
      const parsed = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" }); if (!parsed.length) throw new Error("الملف لا يحتوي على بيانات");
      setHeaders(Object.keys(parsed[0])); setRows(parsed);
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر قراءة الملف"); }
  }

  async function createBatch() {
    if (!rows.length) return;
    if (missing.length) { setError(`الأعمدة الإلزامية مفقودة: ${missing.map((x) => selected.fields.find((f) => f.key === x)?.label || x).join("، ")}`); return; }
    setBusy(true); setError("");
    try {
      const org = window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId"); if (!org) throw new Error("لم يتم تحديد مساحة العمل");
      const payload = rows.map((r) => Object.fromEntries(selected.fields.map((f) => [f.key, r[mapping[f.key]] ?? ""])));
      const s = getSupabaseBrowserClient();
      const { data, error: rpcError } = await s.rpc("create_master_data_import_batch", { p_organization_id: org, p_input_type: typeKey, p_file_name: fileName, p_rows: payload });
      if (rpcError) throw rpcError;
      const { data: review, error: reviewError } = await s.rpc("get_master_data_import_batch", { p_batch_id: data });
      if (reviewError) throw reviewError;
      setBatch(review as Batch);
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر إنشاء دفعة الاستيراد"); } finally { setBusy(false); }
  }

  async function applyBatch() {
    const id = batch?.batch?.id; if (!id || batch?.batch?.status !== "validated") return;
    setBusy(true); setError("");
    try {
      const s = getSupabaseBrowserClient(); const { data, error: rpcError } = await s.rpc("apply_master_data_import_batch", { p_batch_id: id });
      if (rpcError) throw rpcError;
      setBatch((current) => current ? { ...current, batch: { ...current.batch!, status: data.status, accepted_count: data.rows_applied, rejected_count: 0, error_count: 0 } } : current);
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر تطبيق البيانات"); } finally { setBusy(false); }
  }

  return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] px-4 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-7xl space-y-6">
    <header><p className="text-xs font-bold tracking-[0.18em] text-slate-400">DATA IMPORT / MASTER DATA</p><h1 className="mt-2 text-2xl font-bold">استيراد البيانات المرجعية والأبعاد</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">اختر نوع البيانات أولًا. بعد الاختيار ستعرف الحقول المطلوبة، ثم حمّل القالب، ارفع الملف، راجع المطابقة والبيانات، نفّذ التحقق، وبعدها فقط طبّق البيانات على نموذج FP&A.</p></header>
    <div className="grid gap-2 sm:grid-cols-5"><div className="rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-semibold text-white">1 اختر نوع البيانات</div><div className="rounded-lg bg-slate-200 px-3 py-2 text-center text-xs font-semibold">2 القالب والرفع</div><div className="rounded-lg bg-slate-200 px-3 py-2 text-center text-xs font-semibold">3 المطابقة والمراجعة</div><div className="rounded-lg bg-slate-200 px-3 py-2 text-center text-xs font-semibold">4 التحقق</div><div className="rounded-lg bg-slate-200 px-3 py-2 text-center text-xs font-semibold">5 التطبيق</div></div>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{TYPES.map((t) => <button key={t.key} onClick={() => reset(t.key)} className={`rounded-xl border bg-white p-4 text-right transition ${typeKey === t.key ? "border-slate-900 shadow-sm" : "border-slate-200 hover:border-slate-400"}`}><div className="font-semibold">{t.title}</div><div className="mt-1 text-xs leading-5 text-slate-500">{t.help}</div></button>)}</section>
    <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6"><div><h2 className="font-bold">ماذا ستستورد؟</h2><p className="mt-2 text-sm leading-6 text-slate-500">{selected.help}</p></div><div><h3 className="text-sm font-bold">الحقول المطلوبة</h3><div className="mt-2 space-y-2">{selected.fields.map((f) => <div key={f.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{f.label}</span><span className={f.required ? "font-semibold text-red-600" : "text-slate-400"}>{f.required ? "إلزامي" : "اختياري"}</span></div>)}</div></div><div className="flex flex-wrap gap-3"><button onClick={downloadTemplate} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">تحميل القالب</button><label className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />اختيار ملف</label></div>{fileName && <div className="rounded-lg bg-slate-50 p-3 text-sm">الملف: <b>{fileName}</b><br/>الصفوف: <b>{rows.length}</b></div>}{error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}</div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">المطابقة والمراجعة</h2><p className="mt-1 text-xs text-slate-500">سيتم مطابقة أسماء الأعمدة العربية أو الإنجليزية تلقائيًا، ولن يبدأ التحقق إلا بعد اكتمال الأعمدة الإلزامية.</p></div><span className="text-sm text-slate-500">{rows.length ? `أول ${Math.min(50, rows.length)} صف` : "لا يوجد ملف"}</span></div>{rows.length ? <><div className="mt-4 rounded-lg border border-slate-200 p-3 text-sm"><b>حالة المطابقة:</b> {missing.length ? <span className="text-red-700">توجد أعمدة ناقصة: {missing.map((x) => selected.fields.find((f) => f.key === x)?.label || x).join("، ")}</span> : <span className="text-emerald-700">اكتملت الأعمدة الإلزامية</span>}</div><div className="mt-4 overflow-auto rounded-lg border border-slate-200"><table className="w-full min-w-max text-right text-sm"><thead className="bg-slate-50"><tr>{selected.fields.map((f) => <th key={f.key} className="whitespace-nowrap px-3 py-2">{f.label}</th>)}</tr></thead><tbody>{rows.slice(0,50).map((r,i)=><tr key={i} className="border-t border-slate-100">{selected.fields.map((f)=><td key={f.key} className="whitespace-nowrap px-3 py-2">{String(value(mapping[f.key] ? r : {}, mapping[f.key] || f.key))}</td>)}</tr>)}</tbody></table></div><div className="mt-4 flex flex-wrap gap-3"><button disabled={busy || missing.length>0} onClick={createBatch} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "جارٍ التحقق…" : "رفع والتحقق"}</button>{batch?.batch?.status === "validated" && <button disabled={busy} onClick={applyBatch} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">تطبيق البيانات</button>}</div></> : <div className="py-20 text-center text-sm text-slate-400">ابدأ باختيار نوع البيانات ثم تحميل القالب أو اختيار ملفك</div>}
      {batch?.batch && <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="grid gap-3 sm:grid-cols-4"><div>الحالة<br/><b>{batch.batch.status}</b></div><div>إجمالي الصفوف<br/><b>{batch.batch.row_count}</b></div><div>مقبول<br/><b>{batch.batch.accepted_count}</b></div><div>أخطاء<br/><b className={batch.batch.error_count ? "text-red-700" : "text-slate-900"}>{batch.batch.error_count}</b></div></div></div>}
      {invalidRows.length>0 && <div className="mt-4 max-h-64 overflow-auto rounded-xl border border-red-200 bg-red-50 p-4"><h3 className="font-bold text-red-800">أخطاء التحقق</h3><div className="mt-3 space-y-2 text-sm text-red-700">{invalidRows.slice(0,100).map((r)=><div key={r.row_number}><b>الصف {r.row_number}:</b> {r.validation_errors.join("، ")}</div>)}</div></div>}
      {batch?.batch?.status === "applied" && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">تم تطبيق البيانات الأساسية بنجاح وأصبحت متاحة لنموذج FP&A.</div>}
      </div>
    </section>
  </div></main>;
}
