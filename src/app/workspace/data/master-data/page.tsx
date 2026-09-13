"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const TYPES = [
  { key: "legal_entities", title: "الكيانات القانونية", help: "الشركات والكيانات القانونية داخل المنشأة", fields: ["code", "name", "currency"] },
  { key: "branches", title: "الفروع", help: "الفروع وربط كل فرع بكيانه القانوني", fields: ["code", "name", "legal_entity_code", "country", "city", "address", "branch_type", "registration_number", "tax_id", "contact_phone", "contact_email", "manager_name", "is_active"] },
  { key: "departments", title: "الأقسام", help: "الأقسام التنظيمية", fields: ["code", "name"] },
  { key: "cost_centers", title: "مراكز التكلفة", help: "مراكز التكلفة المستخدمة في التحليل", fields: ["code", "name"] },
  { key: "regions", title: "المناطق", help: "المناطق الجغرافية", fields: ["code", "name"] },
  { key: "products", title: "المنتجات", help: "المنتجات أو الخدمات", fields: ["code", "name"] },
  { key: "projects", title: "المشروعات", help: "المشروعات ومجالات المتابعة", fields: ["code", "name"] },
] as const;

const LABELS: Record<string, string> = { code: "الكود", name: "الاسم", currency: "العملة", legal_entity_code: "كود الكيان القانوني", country: "الدولة", city: "المدينة", address: "العنوان", branch_type: "نوع الفرع", registration_number: "رقم السجل", tax_id: "الرقم الضريبي", contact_phone: "الهاتف", contact_email: "البريد", manager_name: "اسم المدير", is_active: "نشط" };

export default function MasterDataImportPage() {
  const [typeKey, setTypeKey] = useState<(typeof TYPES)[number]["key"]>("legal_entities");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [batchId, setBatchId] = useState("");
  const [batch, setBatch] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = useMemo(() => TYPES.find((x) => x.key === typeKey)!, [typeKey]);

  function downloadTemplate() {
    const sample: Record<string, string> = {};
    selected.fields.forEach((f) => { sample[f] = f === "currency" ? "SAR" : f === "is_active" ? "true" : ""; });
    const ws = XLSX.utils.json_to_sheet([sample]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Master Data");
    XLSX.writeFile(wb, `FPA-${typeKey}-template.xlsx`);
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return; setError(""); setBatch(null); setBatchId(""); setFileName(f.name);
    try {
      if (f.size > 20 * 1024 * 1024) throw new Error("حجم الملف يتجاوز 20MB");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]]; if (!sheet) throw new Error("لم يتم العثور على ورقة بيانات");
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!parsed.length) throw new Error("الملف لا يحتوي على بيانات");
      const headers = Object.keys(parsed[0]);
      const mapped = parsed.map((r) => { const out: Record<string, unknown> = {}; selected.fields.forEach((f) => { const h = headers.find((x) => x.trim().toLowerCase() === f.toLowerCase() || x.trim() === LABELS[f]); out[f] = h ? r[h] : ""; }); return out; });
      setRows(mapped);
    } catch (err) { setRows([]); setError(err instanceof Error ? err.message : "تعذر قراءة الملف"); }
  }

  async function createBatch() {
    if (!rows.length) return; setBusy(true); setError("");
    try {
      const org = window.sessionStorage.getItem("activeOrganizationId"); if (!org) throw new Error("لم يتم تحديد مساحة العمل");
      const s = getSupabaseBrowserClient();
      const { data, error: rpcError } = await s.rpc("create_master_data_import_batch", { p_organization_id: org, p_input_type: typeKey, p_file_name: fileName, p_rows: rows });
      if (rpcError) throw rpcError; setBatchId(String(data));
      const { data: review, error: reviewError } = await s.rpc("get_master_data_import_batch", { p_batch_id: data });
      if (reviewError) throw reviewError; setBatch(review);
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر إنشاء دفعة الاستيراد"); } finally { setBusy(false); }
  }

  async function applyBatch() {
    if (!batchId || batch?.batch?.status !== "validated") return; setBusy(true); setError("");
    try { const s = getSupabaseBrowserClient(); const { data, error: e } = await s.rpc("apply_master_data_import_batch", { p_batch_id: batchId }); if (e) throw e; setBatch((x: any) => ({ ...x, batch: { ...x.batch, ...data } })); }
    catch (err) { setError(err instanceof Error ? err.message : "تعذر تطبيق البيانات"); } finally { setBusy(false); }
  }

  return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] px-4 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-6xl space-y-6">
    <header><p className="text-xs font-bold tracking-[0.18em] text-slate-400">DATA IMPORT</p><h1 className="mt-2 text-2xl font-bold">استيراد البيانات المرجعية والأبعاد</h1><p className="mt-2 text-sm text-slate-500">هذه العملية تنشئ أو تحدّث البيانات الأساسية التي تعتمد عليها نماذج FP&A والتحليل متعدد الأبعاد.</p></header>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{TYPES.map((t) => <button key={t.key} onClick={() => { setTypeKey(t.key); setRows([]); setBatch(null); setBatchId(""); setError(""); }} className={`rounded-xl border p-4 text-right transition ${typeKey===t.key ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-400"}`}><div className="font-semibold">{t.title}</div><div className="mt-1 text-xs text-slate-500">{t.help}</div></button>)}</div></section>
    <section className="grid gap-6 lg:grid-cols-[1fr_1.4fr]"><div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold">{selected.title}</h2><p className="mt-2 text-sm text-slate-500">الحقول: {selected.fields.map((f) => LABELS[f] || f).join("، ")}</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={downloadTemplate} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">تحميل القالب</button><label className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />اختيار ملف</label></div>{fileName && <p className="mt-4 text-sm text-slate-600">الملف: <b>{fileName}</b></p>}{error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}</div>
    <div className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><h2 className="font-bold">المراجعة</h2><span className="text-sm text-slate-500">{rows.length} صف</span></div>{rows.length ? <><div className="mt-4 max-h-80 overflow-auto rounded-lg border border-slate-200"><table className="w-full text-right text-sm"><thead className="sticky top-0 bg-slate-50"><tr>{selected.fields.map((f) => <th key={f} className="whitespace-nowrap px-3 py-2">{LABELS[f] || f}</th>)}</tr></thead><tbody>{rows.slice(0,50).map((r,i)=><tr key={i} className="border-t border-slate-100">{selected.fields.map((f)=><td key={f} className="whitespace-nowrap px-3 py-2">{String(r[f] ?? "")}</td>)}</tr>)}</tbody></table></div><div className="mt-4 flex gap-3"><button disabled={busy} onClick={createBatch} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?"جارٍ التحقق…":"رفع والتحقق"}</button>{batch?.batch?.status === "validated" && <button disabled={busy} onClick={applyBatch} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">تطبيق البيانات</button>}</div></> : <div className="mt-12 text-center text-sm text-slate-400">اختر ملف Excel أو CSV لمعاينته قبل الإرسال</div>}{batch && <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm"><div>الحالة: <b>{batch.batch.status}</b></div><div>المقبول: {batch.batch.accepted_count} · الأخطاء: {batch.batch.error_count}</div>{batch.batch.error_count>0 && <div className="mt-2 text-red-700">راجع صفوف الأخطاء قبل إعادة المحاولة</div>}{batch.batch.status==='applied' && <div className="mt-2 font-semibold text-emerald-700">تم تطبيق البيانات بنجاح</div>}</div>}</div></section>
  </div></main>;
}
