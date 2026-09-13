"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Row = Record<string, unknown>;
type Issue = { row: number; message: string };
type Payload = Record<string, string | number | null>;
type Field = { key: string; label: string; aliases: string[]; required?: boolean };

const coreFields: Field[] = [
  { key: "date", label: "التاريخ", aliases: ["التاريخ", "date", "Date", "posting date", "تاريخ القيد"], required: true },
  { key: "journal_no", label: "رقم القيد", aliases: ["رقم القيد", "journal_no", "journal number", "Journal No", "journal no", "رقم اليومية"], required: true },
  { key: "description", label: "بيان القيد", aliases: ["بيان القيد", "وصف القيد", "الوصف", "description", "Description", "journal description", "narration", "memo", "البيان"], required: true },
  { key: "account_code", label: "رقم الحساب", aliases: ["رقم الحساب", "كود الحساب", "account code", "Account Code", "account no", "account number", "Account No", "GL Code"], required: true },
  { key: "account_name", label: "اسم الحساب", aliases: ["اسم الحساب", "account name", "Account Name", "GL Account Name"], required: true },
  { key: "debit", label: "مدين", aliases: ["مدين", "debit", "Debit", "debit amount"], required: true },
  { key: "credit", label: "دائن", aliases: ["دائن", "credit", "Credit", "credit amount"], required: true },
];

const commonOptionalFields: Field[] = [
  { key: "document_no", label: "رقم المستند", aliases: ["رقم المستند", "document no", "document_no", "Document No", "document number", "رقم الوثيقة"] },
  { key: "document_type", label: "نوع المستند", aliases: ["نوع المستند", "document type", "document_type", "Document Type", "document category"] },
  { key: "currency", label: "العملة", aliases: ["العملة", "currency", "Currency", "currency code"] },
  { key: "exchange_rate", label: "سعر الصرف", aliases: ["سعر الصرف", "exchange rate", "exchange_rate", "Exchange Rate", "fx rate"] },
];

const analyticalOptionalFields: Field[] = [
  { key: "legal_entity", label: "الكيان القانوني", aliases: ["الكيان القانوني", "legal entity", "legal_entity", "entity", "company"] },
  { key: "branch", label: "الفرع", aliases: ["الفرع", "branch", "branch name"] },
  { key: "department", label: "القسم", aliases: ["القسم", "department", "department name"] },
  { key: "cost_center", label: "مركز التكلفة", aliases: ["مركز التكلفة", "cost center", "cost_center", "cost centre"] },
  { key: "region", label: "المنطقة", aliases: ["المنطقة", "region", "region name"] },
  { key: "product", label: "المنتج", aliases: ["المنتج", "product", "product name", "item"] },
  { key: "project", label: "المشروع", aliases: ["المشروع", "project", "project name"] },
];

const technicalOptionalFields: Field[] = [
  { key: "line_no", label: "رقم السطر", aliases: ["رقم السطر", "line_no", "line number", "Line No", "line"] },
];

const fields = [...coreFields, ...commonOptionalFields, ...analyticalOptionalFields, ...technicalOptionalFields];
const required = coreFields;
const optional = [...commonOptionalFields, ...analyticalOptionalFields, ...technicalOptionalFields];

const norm = (v: unknown) => String(v ?? "").replace(/\u00a0/g, " ").trim().toLowerCase().replace(/\s+/g, " ");
const text = (v: unknown) => String(v ?? "").replace(/\u00a0/g, " ").trim();
const num = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const t = String(v ?? "").replace(/\u00a0/g, " ").replace(/,/g, "").replace(/٬/g, "").trim();
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

// Accept common ERP/export date formats, including timestamps such as
// "2026-09-12 00:41:38" and ISO timestamps. The stored canonical value is YYYY-MM-DD.
const parseDate = (v: unknown) => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  const t = text(v);
  const match = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
  if (!match) return "";
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.getFullYear() === Number(y) && date.getMonth() === Number(m) - 1 && date.getDate() === Number(d) ? `${y}-${m}-${d}` : "";
};

function autoMap(headers: string[]) {
  const result: Record<string, string> = {};
  for (const field of fields) {
    const match = headers.find((header) => field.aliases.some((alias) => norm(alias) === norm(header)));
    if (match) result[field.key] = match;
  }
  return result;
}

function validateRows(rows: Row[], mapping: Record<string, string>) {
  const issues: Issue[] = [];
  const grouped = new Map<string, { debit: number; credit: number; row: number }>();

  rows.forEach((row, index) => {
    const line = index + 2;
    const journalNo = text(mapping.journal_no ? row[mapping.journal_no] : "");
    const description = text(mapping.description ? row[mapping.description] : "");
    const accountCode = text(mapping.account_code ? row[mapping.account_code] : "");
    const accountName = text(mapping.account_name ? row[mapping.account_name] : "");
    const debit = num(mapping.debit ? row[mapping.debit] : "");
    const credit = num(mapping.credit ? row[mapping.credit] : "");

    if (!parseDate(mapping.date ? row[mapping.date] : "")) issues.push({ row: line, message: "التاريخ غير صالح أو غير مربوط" });
    if (!journalNo) issues.push({ row: line, message: "رقم القيد مفقود" });
    if (!description) issues.push({ row: line, message: "بيان القيد مفقود" });
    if (!accountCode) issues.push({ row: line, message: "رقم الحساب مفقود" });
    if (!accountName) issues.push({ row: line, message: "اسم الحساب مفقود" });
    if (Number.isNaN(debit) || Number.isNaN(credit)) issues.push({ row: line, message: "المدين أو الدائن ليس رقمًا صالحًا" });

    if (!Number.isNaN(debit) && !Number.isNaN(credit)) {
      if (debit < 0 || credit < 0) issues.push({ row: line, message: "لا يسمح بقيم سالبة" });
      if (debit > 0 && credit > 0) issues.push({ row: line, message: "السطر لا يجوز أن يحتوي مدين ودائن معًا" });
      if (debit === 0 && credit === 0) issues.push({ row: line, message: "السطر يجب أن يحتوي قيمة مدين أو دائن" });
      if (journalNo) {
        const current = grouped.get(journalNo) ?? { debit: 0, credit: 0, row: line };
        current.debit += debit;
        current.credit += credit;
        grouped.set(journalNo, current);
      }
    }

    if (mapping.exchange_rate) {
      const raw = text(row[mapping.exchange_rate]);
      if (raw && Number.isNaN(num(raw))) issues.push({ row: line, message: "سعر الصرف غير صالح" });
      if (raw && num(raw) <= 0) issues.push({ row: line, message: "سعر الصرف يجب أن يكون أكبر من صفر" });
    }
  });

  grouped.forEach((value, journalNo) => {
    const difference = Math.abs(value.debit - value.credit);
    if (difference > 0.005) issues.push({ row: value.row, message: `القيد ${journalNo} غير متوازن: الفرق ${difference.toFixed(2)}` });
  });

  return issues;
}

function buildPayload(rows: Row[], mapping: Record<string, string>): Payload[] {
  return rows.map((row) => {
    const payload: Payload = {
      date: parseDate(mapping.date ? row[mapping.date] : ""),
      journal_no: text(mapping.journal_no ? row[mapping.journal_no] : ""),
      description: text(mapping.description ? row[mapping.description] : ""),
      account_code: text(mapping.account_code ? row[mapping.account_code] : ""),
      account_name: text(mapping.account_name ? row[mapping.account_name] : ""),
      debit: num(mapping.debit ? row[mapping.debit] : ""),
      credit: num(mapping.credit ? row[mapping.credit] : ""),
    };

    for (const field of optional) {
      if (!mapping[field.key]) continue;
      const raw = row[mapping[field.key]];
      payload[field.key] = field.key === "exchange_rate" ? (text(raw) ? num(raw) : null) : (text(raw) || null);
    }
    return payload;
  });
}

async function hash(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const importTypes = [
  { title: "القيود اليومية / الحركات الفعلية", description: "المصدر التفصيلي لـ Actuals والتحليل المالي والمقارنات.", active: true },
  { title: "ميزان المراجعة", description: "أرصدة الحسابات لفترة محددة عندما لا تتوفر القيود اليومية.", active: false },
  { title: "دليل الحسابات", description: "أكواد وأسماء الحسابات وتصنيفها وربطها بالنموذج المالي.", active: false },
  { title: "البيانات المرجعية والأبعاد", description: "الكيانات والفروع والأقسام ومراكز التكلفة والمناطق والمنتجات والمشروعات.", active: false },
  { title: "Budget / Forecast / Drivers", description: "بيانات التخطيط والافتراضات والمحركات وتبقى منفصلة عن Actuals.", active: false },
];

export default function DataImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "reading" | "validated" | "saving">("idle");
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);

  const missing = useMemo(() => required.filter((field) => !mapping[field.key]), [mapping]);
  const issues = useMemo(() => validateRows(rows, mapping), [rows, mapping]);
  const ready = rows.length > 0 && missing.length === 0 && issues.length === 0;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setStatus("reading");
    setError("");
    setApproved(false);
    setRows([]);
    setHeaders([]);
    setMapping({});
    setName(selected.name);
    setFile(selected);

    if (selected.size > 20 * 1024 * 1024) {
      setStatus("idle");
      setError("حجم الملف يتجاوز 20MB.");
      return;
    }

    try {
      const workbook = XLSX.read(await selected.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("لم يتم العثور على ورقة بيانات");
      const parsed = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
      if (!parsed.length) throw new Error("الملف لا يحتوي على صفوف بيانات");
      const fileHeaders = Object.keys(parsed[0]);
      setHeaders(fileHeaders);
      setRows(parsed);
      setMapping(autoMap(fileHeaders));
      setStatus("validated");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "تعذر قراءة الملف");
    }
  }

  async function approveAndIngest() {
    if (!file || !ready || !approved || status !== "validated") return;
    setStatus("saving");
    setError("");
    try {
      const organizationId = window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId");
      if (!organizationId) throw new Error("لم يتم تحديد مساحة العمل");
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("الحفظ يتطلب تسجيل الدخول");

      const { data, error: ingestError } = await supabase.rpc("ingest_validated_import", {
        p_organization_id: organizationId,
        p_file_name: file.name,
        p_file_hash: await hash(file),
        p_rows: buildPayload(rows, mapping),
      });
      if (ingestError) throw ingestError;
      if (!data) throw new Error("لم يتم إنشاء عملية الاستيراد");
      router.push(`/workspace/data/${data}`);
    } catch (err) {
      setStatus("validated");
      setError(err instanceof Error ? err.message : "تعذر بدء الاستيراد");
    }
  }

  function downloadTemplate() {
    const data = [
      { التاريخ: "2026-01-01", "رقم القيد": "JE-0001", "بيان القيد": "تحصيل مبيعات نقدية", "رقم الحساب": "1000", "اسم الحساب": "النقدية", مدين: 1000, دائن: 0, "رقم المستند": "RC-0001", "نوع المستند": "Receipt", العملة: "SAR", "سعر الصرف": 1, "الكيان القانوني": "", الفرع: "", القسم: "", "مركز التكلفة": "", المنطقة: "", المنتج: "", المشروع: "" },
      { التاريخ: "2026-01-01", "رقم القيد": "JE-0001", "بيان القيد": "تحصيل مبيعات نقدية", "رقم الحساب": "4000", "اسم الحساب": "الإيرادات", مدين: 0, دائن: 1000, "رقم المستند": "RC-0001", "نوع المستند": "Receipt", العملة: "SAR", "سعر الصرف": 1, "الكيان القانوني": "", الفرع: "", القسم: "", "مركز التكلفة": "", المنطقة: "", المنتج: "", المشروع: "" },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), "القيود اليومية");
    XLSX.writeFile(workbook, "FPA-journal-universal-template.xlsx");
  }

  return <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8"><a href="/workspace" className="text-sm font-semibold text-slate-500">العودة لمساحة العمل</a><div className="text-right"><p className="text-[10px] font-bold tracking-[.14em] text-slate-400">DATA & IMPORTS</p><h1 className="mt-1 font-bold text-slate-950">البيانات والاستيرادات</h1></div></div></header>
    <section className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-7"><h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">استيراد القيود اليومية / Actuals</h2><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-500">تنسيق موحد يقبل ملفات المستخدمين المختلفة دون افتراض قالب محاسبي بعينه. نكتشف أسماء الأعمدة تلقائيًا بالعربية أو الإنجليزية، ثم نسمح بالمطابقة اليدوية قبل التحقق.</p></div>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h3 className="font-bold text-slate-950">أنواع البيانات</h3><p className="mt-1 text-xs leading-6 text-slate-500">المسار المفتوح حاليًا هو القيود اليومية. بقية الأنواع لها عقود مستقلة وستُفتح بعد اكتمال دورة كل نوع.</p></div><div className="grid gap-3 md:grid-cols-2">{importTypes.map((item) => <div key={item.title} className={`rounded-xl border p-4 ${item.active ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white opacity-70"}`}><div className="flex items-start justify-between gap-3"><div><h4 className="font-bold text-slate-900">{item.title}</h4><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p></div><span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">{item.active ? "متاح الآن" : "قريبًا"}</span></div></div>)}</div></section>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-slate-950">عقد البيانات الموحد</h3><p className="mt-1 text-xs leading-6 text-slate-500">الحقول الأساسية مطلوبة في كل ملف. الحقول الاختيارية لا تمنع الاستيراد ويمكن تركها غير موجودة بالكامل.</p></div><button onClick={downloadTemplate} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold">تنزيل القالب الموحد</button></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><h4 className="font-bold text-slate-900">الحقول الأساسية — مطلوبة</h4><div className="mt-3 grid gap-2">{coreFields.map((field) => <div key={field.key} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700"><span className="text-red-500">*</span> {field.label}</div>)}</div></div><div className="rounded-xl bg-slate-50 p-4"><h4 className="font-bold text-slate-900">حقول شائعة — اختيارية</h4><div className="mt-3 grid gap-2">{commonOptionalFields.map((field) => <div key={field.key} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700">{field.label}</div>)}</div></div><div className="rounded-xl bg-slate-50 p-4"><h4 className="font-bold text-slate-900">أبعاد تحليلية — اختيارية</h4><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{analyticalOptionalFields.map((field) => <div key={field.key} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700">{field.label}</div>)}</div></div></div>
        <div className="mt-4 rounded-xl border border-slate-200 p-4 text-sm leading-7 text-slate-600"><b>ملاحظة:</b> التاريخ يقبل التاريخ فقط أو الطابع الزمني الشائع من أنظمة ERP مثل <code>2026-09-12 00:41:38</code>، ويحوّله النظام داخليًا إلى <code>YYYY-MM-DD</code>.</div>
      </section>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-950">رفع الملف</h3><p className="mt-1 text-xs leading-6 text-slate-500">Excel أو CSV حتى 20MB. يتم تحليل أول ورقة فقط، ولا يتم إرسال البيانات قبل المراجعة والموافقة.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"><input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />{status === "reading" ? "جارٍ قراءة الملف..." : "اختيار Excel / CSV"}</label>{name && <span className="text-sm text-slate-500">{name}</span>}</div></section>
      {headers.length > 0 && <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="font-bold text-slate-950">مطابقة الأعمدة</h3><p className="mt-1 text-xs leading-6 text-slate-500">تمت المطابقة تلقائيًا باستخدام أسماء عربية وإنجليزية شائعة. يمكنك تعديل أي حقل يدويًا. الحقول الاختيارية يمكن تركها «غير مربوط».</p></div><span className="text-xs font-semibold text-slate-400">{headers.length} عمودًا مكتشفًا</span></div><div className="mt-5 space-y-3">{fields.map((field) => <div key={field.key} className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-[1fr_1fr] sm:items-center"><div><span className="text-sm font-semibold text-slate-800">{field.label}</span>{field.required && <span className="mr-1 text-red-600">*</span>}<div className="mt-1 text-[11px] text-slate-400">{field.required ? "حقل أساسي" : "اختياري"}</div></div><select value={mapping[field.key] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">— غير مربوط —</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></div>)}</div>{missing.length > 0 ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>حقول أساسية غير مربوطة:</strong> {missing.map((field) => field.label).join("، ")}</div> : <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">تم ربط جميع الحقول الأساسية. الحقول الاختيارية لا تمنع المتابعة.</div>}</section>}
      {rows.length > 0 && <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-950">التحقق والمعاينة</h3><p className="mt-1 text-xs leading-6 text-slate-500">تمت مراجعة {rows.length} سطرًا محليًا قبل الإرسال إلى دورة الاستيراد الخلفية.</p></div><span className="text-xs font-semibold text-slate-400">عرض أول 50 سطرًا</span></div>{issues.length > 0 ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"><p className="font-bold text-red-800">تم العثور على {issues.length} مشكلة ويجب تصحيحها قبل بدء الاستيراد</p><div className="mt-2 max-h-56 overflow-auto text-sm text-red-700">{issues.slice(0, 100).map((issue, index) => <div key={`${issue.row}-${index}`}>السطر {issue.row}: {issue.message}</div>)}</div></div> : <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">لا توجد أخطاء أولية. القيود متوازنة حسب رقم القيد وجاهزة للانتقال إلى التحقق والمطابقة الخلفية.</div>}<div className="mt-4 overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1300px] text-right text-sm"><thead className="bg-slate-50"><tr>{coreFields.map((field) => <th key={field.key} className="whitespace-nowrap px-3 py-2">{field.label}</th>)}{commonOptionalFields.map((field) => <th key={field.key} className="whitespace-nowrap px-3 py-2 text-slate-500">{field.label}</th>)}</tr></thead><tbody>{rows.slice(0, 50).map((row, index) => <tr key={index} className="border-t border-slate-100">{[...coreFields, ...commonOptionalFields].map((field) => <td key={field.key} className="whitespace-nowrap px-3 py-2">{text(mapping[field.key] ? row[mapping[field.key]] : "")}</td>)}</tr>)}</tbody></table></div>{error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}{ready && <div className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-5"><label className="flex items-start gap-3 text-sm leading-6 text-slate-600"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} className="mt-1" />أقر أنني راجعت نوع البيانات والمطابقة والمعاينة وأن الملف يحتوي على بيانات المنشأة الصحيحة وأوافق على بدء عملية الاستيراد</label><button disabled={!approved || status === "saving"} onClick={approveAndIngest} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{status === "saving" ? "جارٍ بدء الاستيراد..." : "بدء الاستيراد"}</button></div>}</section>}
    </section>
  </main>;
}