"use client";

import { ChangeEvent, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Row = Record<string, unknown>;
type ValidationIssue = { row: number; message: string };
type ImportPayload = Record<string, string | number | null>;

const required = ["التاريخ", "رقم القيد", "وصف القيد", "كود الحساب", "اسم الحساب", "مدين", "دائن"];
const optionalFields = ["الكيان القانوني", "الفرع", "القسم", "مركز التكلفة", "المنطقة", "المشروع"];

const aliases: Record<string, string[]> = {
  "التاريخ": ["التاريخ", "date", "Date"],
  "رقم القيد": ["رقم القيد", "journal_no", "journal number", "Journal No"],
  "وصف القيد": ["وصف القيد", "الوصف", "description", "Description"],
  "كود الحساب": ["كود الحساب", "account code", "Account Code"],
  "اسم الحساب": ["اسم الحساب", "account name", "Account Name"],
  "مدين": ["مدين", "debit", "Debit"],
  "دائن": ["دائن", "credit", "Credit"],
  "الكيان القانوني": ["الكيان القانوني", "legal entity", "legal_entity"],
  "الفرع": ["الفرع", "branch"],
  "القسم": ["القسم", "department"],
  "مركز التكلفة": ["مركز التكلفة", "cost center", "cost_center"],
  "المنطقة": ["المنطقة", "region"],
  "المشروع": ["المشروع", "project"],
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const text = String(value ?? "").replace(/,/g, "").replace(/٬/g, "").trim();
  if (!text) return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function dateValue(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function mapHeaders(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const canonical of [...required, ...optionalFields]) {
    const match = headers.find((header) => aliases[canonical].some((alias) => normalize(alias) === normalize(header)));
    if (match) result[canonical] = match;
  }
  return result;
}

function validate(rows: Row[], mapping: Record<string, string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const grouped = new Map<string, { debit: number; credit: number; row: number }>();

  rows.forEach((row, index) => {
    const line = index + 2;
    const date = dateValue(row[mapping["التاريخ"]]);
    const journal = String(row[mapping["رقم القيد"]] ?? "").trim();
    const accountCode = String(row[mapping["كود الحساب"]] ?? "").trim();
    const accountName = String(row[mapping["اسم الحساب"]] ?? "").trim();
    const debit = numberValue(row[mapping["مدين"]]);
    const credit = numberValue(row[mapping["دائن"]]);

    if (!date) issues.push({ row: line, message: "التاريخ غير صالح. استخدم YYYY-MM-DD" });
    if (!journal) issues.push({ row: line, message: "رقم القيد مفقود" });
    if (!accountCode) issues.push({ row: line, message: "كود الحساب مفقود" });
    if (!accountName) issues.push({ row: line, message: "اسم الحساب مفقود" });
    if (Number.isNaN(debit) || Number.isNaN(credit)) issues.push({ row: line, message: "المدين أو الدائن ليس رقمًا صالحًا" });

    if (!Number.isNaN(debit) && !Number.isNaN(credit)) {
      if (debit < 0 || credit < 0) issues.push({ row: line, message: "لا يسمح بقيمة سالبة في المدين أو الدائن" });
      if (debit > 0 && credit > 0) issues.push({ row: line, message: "السطر لا يجوز أن يحتوي مدين ودائن معًا" });
      if (debit === 0 && credit === 0) issues.push({ row: line, message: "السطر يجب أن يحتوي قيمة مدين أو دائن" });
      if (journal) {
        const current = grouped.get(journal) ?? { debit: 0, credit: 0, row: line };
        current.debit += debit;
        current.credit += credit;
        grouped.set(journal, current);
      }
    }
  });

  grouped.forEach((entry, journal) => {
    const difference = Math.abs(entry.debit - entry.credit);
    if (difference > 0.005) {
      issues.push({ row: entry.row, message: `القيد ${journal} غير متوازن: الفرق ${difference.toFixed(2)}` });
    }
  });

  return issues;
}

function normalizeRows(rows: Row[], mapping: Record<string, string>): ImportPayload[] {
  return rows.map((row) => {
    const payload: ImportPayload = {
      date: dateValue(row[mapping["التاريخ"]]),
      journal_no: String(row[mapping["رقم القيد"]] ?? "").trim(),
      description: String(row[mapping["وصف القيد"]] ?? "").trim(),
      account_code: String(row[mapping["كود الحساب"]] ?? "").trim(),
      account_name: String(row[mapping["اسم الحساب"]] ?? "").trim(),
      debit: numberValue(row[mapping["مدين"]]),
      credit: numberValue(row[mapping["دائن"]]),
    };

    for (const field of optionalFields) {
      if (mapping[field]) payload[field] = String(row[mapping[field]] ?? "").trim() || null;
    }
    return payload;
  });
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function DataImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [status, setStatus] = useState<"idle" | "reading" | "validated" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const [savedImportId, setSavedImportId] = useState("");

  const mapping = useMemo(() => mapHeaders(headers), [headers]);
  const missing = required.filter((field) => !mapping[field]);
  const canSave = missing.length === 0 && issues.length === 0 && rows.length > 0;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setStatus("reading");
    setError("");
    setIssues([]);
    setRows([]);
    setHeaders([]);
    setSavedImportId("");
    setFile(selectedFile);
    setFileName(selectedFile.name);

    if (selectedFile.size > 20 * 1024 * 1024) {
      setStatus("idle");
      setError("حجم الملف يتجاوز 20MB. قسّم الملف إلى دفعات أصغر قبل الاستيراد.");
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error("لم يتم العثور على ورقة بيانات داخل الملف");
      const parsed = XLSX.utils.sheet_to_json<Row>(firstSheet, { defval: "" });
      if (parsed.length === 0) throw new Error("الملف لا يحتوي على صفوف بيانات");
      const detectedHeaders = Object.keys(parsed[0]);
      const detectedMapping = mapHeaders(detectedHeaders);
      setHeaders(detectedHeaders);
      setRows(parsed);
      setIssues(validate(parsed, detectedMapping));
      setStatus("validated");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "تعذر قراءة الملف");
    }
  }

  async function saveImport() {
    if (!file || !canSave || status !== "validated") return;
    setStatus("saving");
    setError("");

    try {
      const workspaceId = window.localStorage.getItem("fpa_workspace_id");
      if (!workspaceId) throw new Error("لم يتم تحديد مساحة عمل. افتح مساحة العمل أولًا ثم أعد المحاولة.");

      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("الحفظ في قاعدة البيانات يتطلب تسجيل الدخول. التحقق المحلي يعمل بدون تسجيل دخول.");

      const payload = normalizeRows(rows, mapping);
      const fileHash = await sha256(file);
      const { data, error: rpcError } = await supabase.rpc("ingest_validated_import", {
        p_organization_id: workspaceId,
        p_file_name: file.name,
        p_file_hash: fileHash,
        p_rows: payload,
      });

      if (rpcError) throw rpcError;
      if (!data) throw new Error("لم يتم إرجاع رقم عملية الاستيراد");

      setSavedImportId(String(data));
      setStatus("saved");
    } catch (err) {
      setStatus("validated");
      setError(err instanceof Error ? err.message : "تعذر حفظ عملية الاستيراد");
    }
  }

  function downloadTemplate() {
    const data = [
      { التاريخ: "2026-01-01", "رقم القيد": "JE-0001", "وصف القيد": "مثال تجريبي", "كود الحساب": "1000", "اسم الحساب": "البنك", مدين: 1000, دائن: 0 },
      { التاريخ: "2026-01-01", "رقم القيد": "JE-0001", "وصف القيد": "مثال تجريبي", "كود الحساب": "4000", "اسم الحساب": "الإيرادات", مدين: 0, دائن: 1000 },
    ];
    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "القيود اليومية");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["تعليمات"],
      ["التاريخ يجب أن يكون بصيغة YYYY-MM-DD"],
      ["يجب أن يتوازن كل رقم قيد: إجمالي المدين = إجمالي الدائن"],
      ["كل سطر يحتوي مدين أو دائن فقط وليس الاثنين معًا"],
      ["كود الحساب واسم الحساب مطلوبان في كل سطر"],
      ["الأبعاد التحليلية اختيارية ويمكن تركها فارغة"],
    ]), "تعليمات");
    XLSX.writeFile(workbook, "FPA-journal-template.xlsx");
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-5 lg:px-10">
          <a href="/workspace" className="text-sm font-semibold text-slate-500 hover:text-slate-950">العودة لمساحة العمل</a>
          <div className="text-right"><p className="text-xs font-bold tracking-[0.14em] text-slate-400">DATA IMPORT</p><h1 className="mt-1 font-bold text-slate-950">البيانات والاستيراد</h1></div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-6 py-10 lg:px-10">
        <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-8 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold text-slate-400">المرحلة الأولى</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">استيراد البيانات المالية</h2>
            <p className="mt-3 max-w-3xl leading-7 text-slate-500">ارفع ملف Excel أو CSV. النظام يتحقق محليًا ثم يعيد التحقق داخل قاعدة البيانات قبل حفظ عملية الاستيراد وصفوفها.</p>
          </div>
          <button type="button" onClick={downloadTemplate} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50">تنزيل قالب Excel</button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-sm font-bold text-slate-900">1. ارفع الملف</p>
            <label className="mt-5 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-slate-500">
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              <span className="text-lg font-bold text-slate-900">اختر ملف Excel أو CSV</span>
              <span className="mt-2 text-sm text-slate-500">الحد الأقصى 20MB في هذه المرحلة</span>
              {fileName && <span className="mt-5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700">{fileName}</span>}
            </label>
            {status === "reading" && <p className="mt-4 text-sm font-semibold text-slate-500">جاري قراءة الملف والتحقق منه...</p>}
            {status === "saving" && <p className="mt-4 text-sm font-semibold text-slate-500">جاري حفظ عملية الاستيراد والتحقق منها داخل قاعدة البيانات...</p>}
            {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">{error}</p>}
            {status === "saved" && <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-800">تم حفظ الاستيراد بنجاح. رقم العملية: {savedImportId}</div>}
            <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-600">
              <p className="font-bold text-slate-900">قواعد الاستيراد</p>
              <ul className="mt-3 list-disc space-y-1 pr-5"><li>كل قيد يجب أن يكون متوازنًا</li><li>لا يوجد مدين ودائن في السطر نفسه</li><li>لا نقبل قيمًا سالبة</li><li>كود واسم الحساب مطلوبان</li><li>الأبعاد التحليلية اختيارية</li></ul>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-sm font-bold text-slate-900">2. نتيجة التحقق</p><p className="mt-1 text-sm text-slate-500">لا يتم نشر أي Financial Facts من هذه الشاشة.</p></div>
              {status === "validated" && <span className={`rounded-full px-3 py-1 text-xs font-bold ${canSave ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{canSave ? "صالح للحفظ" : "يحتاج تصحيح"}</span>}
            </div>

            {status === "validated" || status === "saving" || status === "saved" ? (
              <>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">عدد الصفوف</p><p className="mt-2 text-2xl font-bold">{rows.length}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">الأخطاء</p><p className="mt-2 text-2xl font-bold text-red-700">{issues.length}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">أعمدة مطلوبة مفقودة</p><p className="mt-2 text-2xl font-bold">{missing.length}</p></div>
                </div>

                {missing.length > 0 && <div className="mt-5 rounded-2xl bg-red-50 p-5 text-sm text-red-800"><p className="font-bold">الأعمدة المطلوبة غير موجودة</p><p className="mt-2">{missing.join("، ")}</p></div>}
                {issues.length > 0 && <div className="mt-5 max-h-64 overflow-auto rounded-2xl border border-red-100 bg-red-50 p-5"><p className="font-bold text-red-800">الأخطاء المكتشفة</p><div className="mt-3 space-y-2 text-sm text-red-700">{issues.slice(0, 100).map((issue, index) => <p key={`${issue.row}-${index}`}>السطر {issue.row}: {issue.message}</p>)}</div>{issues.length > 100 && <p className="mt-3 text-xs font-semibold">تم عرض أول 100 خطأ فقط.</p>}</div>}

                {canSave && status === "validated" && <button type="button" onClick={saveImport} className="mt-6 w-full rounded-xl bg-slate-950 px-6 py-4 text-sm font-bold text-white transition hover:bg-slate-800">حفظ الاستيراد في قاعدة البيانات</button>}
                {status === "saved" && <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold leading-7 text-emerald-800">تم حفظ Import و Import Rows فقط. لن تظهر البيانات في التقارير أو Actuals حتى تمر بالمطابقة ثم النشر.</div>}
              </>
            ) : (
              <div className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm leading-7 text-slate-500">ارفع ملفًا لبدء التحقق.</div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
