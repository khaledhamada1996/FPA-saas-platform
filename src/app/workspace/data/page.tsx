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

const fields: Field[] = [
  { key: "date", label: "التاريخ", aliases: ["التاريخ", "date", "Date"], required: true },
  { key: "journal_no", label: "رقم القيد", aliases: ["رقم القيد", "journal_no", "journal number", "Journal No"], required: true },
  { key: "line_no", label: "رقم السطر", aliases: ["رقم السطر", "line_no", "line number", "Line No"] },
  { key: "description", label: "وصف القيد", aliases: ["وصف القيد", "الوصف", "description", "Description"], required: true },
  { key: "document_type", label: "نوع المستند", aliases: ["نوع المستند", "document type", "document_type", "Document Type"] },
  { key: "document_no", label: "رقم المستند", aliases: ["رقم المستند", "document no", "document_no", "Document No"] },
  { key: "account_code", label: "كود الحساب", aliases: ["كود الحساب", "account code", "Account Code"], required: true },
  { key: "account_name", label: "اسم الحساب", aliases: ["اسم الحساب", "account name", "Account Name"], required: true },
  { key: "debit", label: "مدين", aliases: ["مدين", "debit", "Debit"], required: true },
  { key: "credit", label: "دائن", aliases: ["دائن", "credit", "Credit"], required: true },
  { key: "currency", label: "العملة", aliases: ["العملة", "currency", "Currency"] },
  { key: "exchange_rate", label: "سعر الصرف", aliases: ["سعر الصرف", "exchange rate", "exchange_rate", "Exchange Rate"] },
  { key: "legal_entity", label: "الكيان القانوني", aliases: ["الكيان القانوني", "legal entity", "legal_entity"] },
  { key: "branch", label: "الفرع", aliases: ["الفرع", "branch"] },
  { key: "department", label: "القسم", aliases: ["القسم", "department"] },
  { key: "cost_center", label: "مركز التكلفة", aliases: ["مركز التكلفة", "cost center", "cost_center"] },
  { key: "region", label: "المنطقة", aliases: ["المنطقة", "region"] },
  { key: "product", label: "المنتج", aliases: ["المنتج", "product"] },
  { key: "project", label: "المشروع", aliases: ["المشروع", "project"] },
];

const required = fields.filter((f) => f.required);
const optional = fields.filter((f) => !f.required);
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const num = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const t = String(v ?? "").replace(/,/g, "").replace(/٬/g, "").trim();
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const date = (v: unknown) => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  const t = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
};

function mapHeaders(headers: string[]) {
  const result: Record<string, string> = {};
  for (const field of fields) {
    const match = headers.find((h) => field.aliases.some((a) => norm(a) === norm(h)));
    if (match) result[field.key] = match;
  }
  return result;
}

function validate(rows: Row[], mapping: Record<string, string>) {
  const issues: Issue[] = [];
  const grouped = new Map<string, { debit: number; credit: number; row: number }>();
  rows.forEach((r, i) => {
    const line = i + 2;
    const j = String(r[mapping.journal_no] ?? "").trim();
    const description = String(r[mapping.description] ?? "").trim();
    const ac = String(r[mapping.account_code] ?? "").trim();
    const an = String(r[mapping.account_name] ?? "").trim();
    const d = num(r[mapping.debit]);
    const c = num(r[mapping.credit]);
    if (!date(r[mapping.date])) issues.push({ row: line, message: "التاريخ غير صالح" });
    if (!j) issues.push({ row: line, message: "رقم القيد مفقود" });
    if (!description) issues.push({ row: line, message: "وصف القيد مفقود" });
    if (!ac) issues.push({ row: line, message: "كود الحساب مفقود" });
    if (!an) issues.push({ row: line, message: "اسم الحساب مفقود" });
    if (Number.isNaN(d) || Number.isNaN(c)) issues.push({ row: line, message: "المدين أو الدائن ليس رقمًا صالحًا" });
    if (!Number.isNaN(d) && !Number.isNaN(c)) {
      if (d < 0 || c < 0) issues.push({ row: line, message: "لا يسمح بقيم سالبة" });
      if (d > 0 && c > 0) issues.push({ row: line, message: "السطر لا يجوز أن يحتوي مدين ودائن معًا" });
      if (d === 0 && c === 0) issues.push({ row: line, message: "السطر يجب أن يحتوي قيمة مدين أو دائن" });
      if (j) {
        const x = grouped.get(j) ?? { debit: 0, credit: 0, row: line };
        x.debit += d;
        x.credit += c;
        grouped.set(j, x);
      }
    }
    if (mapping.exchange_rate && String(r[mapping.exchange_rate] ?? "").trim() && Number.isNaN(num(r[mapping.exchange_rate]))) {
      issues.push({ row: line, message: "سعر الصرف غير صالح" });
    }
  });
  grouped.forEach((x, j) => {
    const diff = Math.abs(x.debit - x.credit);
    if (diff > 0.005) issues.push({ row: x.row, message: `القيد ${j} غير متوازن: الفرق ${diff.toFixed(2)}` });
  });
  return issues;
}

function payload(rows: Row[], mapping: Record<string, string>): Payload[] {
  return rows.map((r) => {
    const p: Payload = {
      date: date(r[mapping.date]),
      journal_no: String(r[mapping.journal_no] ?? "").trim(),
      description: String(r[mapping.description] ?? "").trim(),
      account_code: String(r[mapping.account_code] ?? "").trim(),
      account_name: String(r[mapping.account_name] ?? "").trim(),
      debit: num(r[mapping.debit]),
      credit: num(r[mapping.credit]),
    };
    for (const f of optional) if (mapping[f.key]) {
      const raw = r[mapping[f.key]];
      p[f.key] = f.key === "exchange_rate" ? (String(raw ?? "").trim() ? num(raw) : null) : (String(raw ?? "").trim() || null);
    }
    if (mapping.line_no) p.line_no = String(r[mapping.line_no] ?? "").trim() || null;
    return p;
  });
}

async function hash(file: File) {
  const d = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const importTypes = [
  { title: "القيود اليومية / الحركات الفعلية", description: "المصدر التفصيلي لـ Actuals، والتحليل المالي، والمقارنات، مع دعم الأبعاد عند توفرها.", active: true },
  { title: "ميزان المراجعة", description: "أرصدة الحسابات لفترة محددة عندما لا تتوفر القيود اليومية. سيكون مسارًا مستقلًا لاختبار التوازن وبناء Actuals.", active: false },
  { title: "دليل الحسابات", description: "أكواد وأسماء الحسابات وتصنيفها وربطها بالنموذج المالي والحسابات القياسية.", active: false },
  { title: "البيانات المرجعية والأبعاد", description: "الكيانات والفروع والأقسام ومراكز التكلفة والمناطق والمنتجات والمشروعات.", active: false },
  { title: "Budget / Forecast / Drivers", description: "بيانات التخطيط والافتراضات والمحركات، وتبقى منفصلة عن Actuals مع ربطها بالنموذج المالي.", active: false },
];

export default function DataImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [status, setStatus] = useState<"idle" | "reading" | "validated" | "saving">("idle");
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);
  const mapping = useMemo(() => mapHeaders(headers), [headers]);
  const missing = required.filter((f) => !mapping[f.key]);
  const ready = rows.length > 0 && missing.length === 0 && issues.length === 0;

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setStatus("reading"); setError(""); setApproved(false); setRows([]); setHeaders([]); setName(f.name); setFile(f);
    if (f.size > 20 * 1024 * 1024) { setStatus("idle"); setError("حجم الملف يتجاوز 20MB."); return; }
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("لم يتم العثور على ورقة بيانات");
      const parsed = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
      if (!parsed.length) throw new Error("الملف لا يحتوي على صفوف بيانات");
      const h = Object.keys(parsed[0]);
      const m = mapHeaders(h);
      setHeaders(h); setRows(parsed); setIssues(validate(parsed, m)); setStatus("validated");
    } catch (e) { setStatus("idle"); setError(e instanceof Error ? e.message : "تعذر قراءة الملف"); }
  }

  async function approveAndIngest() {
    if (!file || !ready || !approved || status !== "validated") return;
    setStatus("saving"); setError("");
    try {
      const org = window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId");
      if (!org) throw new Error("لم يتم تحديد مساحة عمل");
      const s = getSupabaseBrowserClient();
      const { data: u, error: ue } = await s.auth.getUser();
      if (ue) throw ue;
      if (!u.user) throw new Error("الحفظ يتطلب تسجيل الدخول");
      const { data, error: e } = await s.rpc("ingest_validated_import", {
        p_organization_id: org,
        p_file_name: file.name,
        p_file_hash: await hash(file),
        p_rows: payload(rows, mapping),
      });
      if (e) throw e;
      if (!data) throw new Error("لم يتم إنشاء عملية الاستيراد");
      router.push(`/workspace/data/${data}`);
    } catch (e) { setStatus("validated"); setError(e instanceof Error ? e.message : "تعذر بدء الاستيراد"); }
  }

  function template() {
    const data = [
      { التاريخ: "2026-01-01", "رقم القيد": "JE-0001", "رقم السطر": 1, "وصف القيد": "تحصيل مبيعات نقدية", "نوع المستند": "Receipt", "رقم المستند": "RC-0001", "كود الحساب": "1000", "اسم الحساب": "النقدية", مدين: 1000, دائن: 0, العملة: "SAR", "سعر الصرف": 1, "الكيان القانوني": "", الفرع: "", القسم: "", "مركز التكلفة": "", المنطقة: "", المنتج: "", المشروع: "" },
      { التاريخ: "2026-01-01", "رقم القيد": "JE-0001", "رقم السطر": 2, "وصف القيد": "تحصيل مبيعات نقدية", "نوع المستند": "Receipt", "رقم المستند": "RC-0001", "كود الحساب": "4000", "اسم الحساب": "الإيرادات", مدين: 0, دائن: 1000, العملة: "SAR", "سعر الصرف": 1, "الكيان القانوني": "", الفرع: "", القسم: "", "مركز التكلفة": "", المنطقة: "", المنتج: "", المشروع: "" },
    ];
    const w = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(w, XLSX.utils.json_to_sheet(data), "القيود اليومية");
    XLSX.writeFile(w, "FPA-journal-template.xlsx");
  }

  return <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8"><a href="/workspace" className="text-sm font-semibold text-slate-500">العودة لمساحة العمل</a><div className="text-right"><p className="text-[10px] font-bold tracking-[.14em] text-slate-400">DATA & IMPORTS</p><h1 className="mt-1 font-bold text-slate-950">البيانات والاستيرادات</h1></div></div></header>
    <section className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-7"><h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">اختر نوع البيانات قبل رفع الملف</h2><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-500">كل نوع بيانات له عقد إدخال مستقل. لن نعامل ميزان المراجعة أو دليل الحسابات أو Budget كأنها قيود يومية، لأن كل نوع يحتاج تحققًا وربطًا وتسوية مختلفة قبل دخوله إلى نموذج FP&A.</p></div>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h3 className="font-bold text-slate-950">أنواع البيانات</h3><p className="mt-1 text-xs leading-6 text-slate-500">المسار الوحيد المفتوح حاليًا هو القيود اليومية. الأنواع الأخرى ستُفتح بعد اكتمال دورة كل نوع من المصدر حتى النموذج المالي.</p></div><div className="grid gap-3 md:grid-cols-2">{importTypes.map((item) => <div key={item.title} className={`rounded-xl border p-4 ${item.active ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white opacity-70"}`}><div className="flex items-start justify-between gap-3"><div><h4 className="font-bold text-slate-900">{item.title}</h4><p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p></div><span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">{item.active ? "متاح الآن" : "قريبًا"}</span></div></div>)}</div></section>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-slate-950">المسار الحالي: القيود اليومية / Actuals</h3><p className="mt-1 text-xs leading-6 text-slate-500">يمكن رفع Excel أو CSV. بعد التحقق، تنتقل البيانات إلى Mapping ثم Reconciliation ثم Publish. لا تصبح Actuals منشورة بمجرد رفع الملف.</p></div><button onClick={template} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold">تنزيل القالب الكامل</button></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><h4 className="font-bold text-slate-900">الحقول الأساسية المطلوبة</h4><div className="mt-3 grid gap-2 sm:grid-cols-2">{required.map((f) => <div key={f.key} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700"><span className="text-red-500">*</span> {f.label}</div>)}</div></div><div className="rounded-xl bg-slate-50 p-4"><h4 className="font-bold text-slate-900">حقول اختيارية مدعومة</h4><div className="mt-3 grid gap-2 sm:grid-cols-2">{optional.map((f) => <div key={f.key} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700">{f.label}</div>)}</div></div></div>
        <div className="mt-5 rounded-xl border border-slate-200 p-4"><h4 className="font-bold text-slate-900">قواعد التحقق</h4><ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600 sm:grid-cols-2"><li>• كل قيد يجب أن يكون متوازنًا مدينًا ودائنًا</li><li>• لا يسمح بمدين ودائن في السطر نفسه</li><li>• لا يسمح بقيم سالبة</li><li>• التاريخ ورقم القيد والوصف والحسابات مطلوبة</li><li>• سعر الصرف، إذا أُدخل، يجب أن يكون رقميًا</li><li>• الحد الأقصى للملف 20MB</li></ul></div>
      </section>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold text-slate-950">رفع البيانات والتحقق</h3><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"><input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />{status === "reading" ? "جارٍ قراءة الملف..." : "اختيار Excel / CSV"}</label>{name && <span className="text-sm text-slate-500">{name}</span>}</div>
        {missing.length > 0 && headers.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>حقول ناقصة:</strong> {missing.map((f) => f.label).join("، ")}</div>}
        {issues.length > 0 && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"><p className="font-bold text-red-800">تم العثور على {issues.length} مشكلة ويجب تصحيحها قبل الحفظ</p><div className="mt-2 max-h-48 overflow-auto text-sm text-red-700">{issues.slice(0, 50).map((x, i) => <div key={`${x.row}-${i}`}>السطر {x.row}: {x.message}</div>)}</div></div>}
        {rows.length > 0 && issues.length === 0 && missing.length === 0 && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">تم التحقق محليًا من {rows.length} سطرًا. البيانات جاهزة للانتقال إلى دورة الاستيراد.</div>}
        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {rows.length > 0 && missing.length === 0 && issues.length === 0 && <div className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-5"><label className="flex items-start gap-3 text-sm text-slate-600"><input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="mt-1" />أقر أنني راجعت نوع البيانات والحقول، وأن الملف يحتوي على بيانات منشأتي الصحيحة وأنني أريد بدء عملية الاستيراد للتحقق والمطابقة</label><button disabled={!approved || status === "saving"} onClick={approveAndIngest} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{status === "saving" ? "جارٍ بدء الاستيراد..." : "بدء الاستيراد"}</button></div>}
      </section>
    </section>
  </main>;
}
