"use client";

import { ChangeEvent, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Row = Record<string, unknown>;
type ValidationIssue = { row: number; message: string };

const required = ["التاريخ", "رقم القيد", "وصف القيد", "كود الحساب", "اسم الحساب", "مدين", "دائن"];
const aliases: Record<string, string[]> = {
  "التاريخ": ["التاريخ", "date", "Date"],
  "رقم القيد": ["رقم القيد", "journal_no", "journal number", "Journal No"],
  "وصف القيد": ["وصف القيد", "الوصف", "description", "Description"],
  "كود الحساب": ["كود الحساب", "account code", "Account Code"],
  "اسم الحساب": ["اسم الحساب", "account name", "Account Name"],
  "مدين": ["مدين", "debit", "Debit"],
  "دائن": ["دائن", "credit", "Credit"],
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

function mapHeaders(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const canonical of required) {
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
    const date = String(row[mapping["التاريخ"]] ?? "").trim();
    const journal = String(row[mapping["رقم القيد"]] ?? "").trim();
    const accountCode = String(row[mapping["كود الحساب"]] ?? "").trim();
    const accountName = String(row[mapping["اسم الحساب"]] ?? "").trim();
    const debit = numberValue(row[mapping["مدين"]]);
    const credit = numberValue(row[mapping["دائن"]]);

    if (!date) issues.push({ row: line, message: "التاريخ مفقود" });
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

export default function DataImportPage() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [status, setStatus] = useState<"idle" | "reading" | "validated">("idle");
  const [error, setError] = useState("");

  const mapping = useMemo(() => mapHeaders(headers), [headers]);
  const missing = required.filter((field) => !mapping[field]);
  const valid = status === "validated" && missing.length === 0 && issues.length === 0 && rows.length > 0;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus("reading");
    setError("");
    setIssues([]);
    setRows([]);
    setHeaders([]);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
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
      ["يجب أن يتوازن كل رقم قيد: إجمالي المدين = إجمالي الدائن"],
      ["كل سطر يحتوي مدين أو دائن فقط وليس الاثنين معًا"],
      ["كود الحساب واسم الحساب مطلوبان في كل سطر"],
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
            <p className="mt-3 max-w-3xl leading-7 text-slate-500">ارفع ملف Excel أو CSV. النظام يقرأ البيانات أولًا ثم يتحقق من الأعمدة، القيود، المدين والدائن، وتوازن كل قيد قبل السماح بالانتقال للخطوة التالية.</p>
          </div>
          <button type="button" onClick={downloadTemplate} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50">تنزيل قالب Excel</button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-sm font-bold text-slate-900">1. ارفع الملف</p>
            <label className="mt-5 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-slate-500">
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              <span className="text-lg font-bold text-slate-900">اختر ملف Excel أو CSV</span>
              <span className="mt-2 text-sm text-slate-500">الحد الأقصى الموصى به في هذه المرحلة 20MB</span>
              {fileName && <span className="mt-5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700">{fileName}</span>}
            </label>
            {status === "reading" && <p className="mt-4 text-sm font-semibold text-slate-500">جاري قراءة الملف والتحقق منه...</p>}
            {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
            <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-600">
              <p className="font-bold text-slate-900">قواعد الاستيراد الحالية</p>
              <ul className="mt-3 list-disc space-y-1 pr-5"><li>كل قيد يجب أن يكون متوازنًا</li><li>لا يوجد مدين ودائن في السطر نفسه</li><li>لا نقبل قيمًا سالبة</li><li>كود واسم الحساب مطلوبان</li></ul>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-sm font-bold text-slate-900">2. نتيجة التحقق</p><p className="mt-1 text-sm text-slate-500">لن يتم نشر أي بيانات من هذه الشاشة.</p></div>
              {status === "validated" && <span className={`rounded-full px-3 py-1 text-xs font-bold ${valid ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{valid ? "صالح للانتقال" : "يحتاج تصحيح"}</span>}
            </div>

            {status === "validated" ? (
              <>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">عدد الصفوف</p><p className="mt-2 text-2xl font-bold">{rows.length}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">الأخطاء</p><p className="mt-2 text-2xl font-bold text-red-700">{issues.length}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">أعمدة مطلوبة مفقودة</p><p className="mt-2 text-2xl font-bold">{missing.length}</p></div>
                </div>

                {missing.length > 0 && <div className="mt-5 rounded-2xl bg-red-50 p-5 text-sm text-red-800"><p className="font-bold">الأعمدة المطلوبة غير موجودة</p><p className="mt-2">{missing.join("، ")}</p></div>}
                {issues.length > 0 && <div className="mt-5 max-h-64 overflow-auto rounded-2xl border border-red-100 bg-red-50 p-5"><p className="font-bold text-red-800">الأخطاء المكتشفة</p><div className="mt-3 space-y-2 text-sm text-red-700">{issues.slice(0, 100).map((issue, index) => <p key={`${issue.row}-${index}`}>السطر {issue.row}: {issue.message}</p>)}{issues.length > 100 && <p className="font-semibold">تم إظهار أول 100 خطأ فقط</p>}</div></div>}

                <div className="mt-6 overflow-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-right text-xs"><thead className="bg-slate-50"><tr>{headers.slice(0, 8).map((header) => <th key={header} className="whitespace-nowrap px-4 py-3 font-bold text-slate-600">{header}</th>)}</tr></thead><tbody>{rows.slice(0, 10).map((row, index) => <tr key={index} className="border-t border-slate-100">{headers.slice(0, 8).map((header) => <td key={header} className="whitespace-nowrap px-4 py-3 text-slate-600">{String(row[header] ?? "")}</td>)}</tr>)}</tbody></table>
                </div>
                <p className="mt-5 text-xs leading-6 text-slate-400">المعاينة لا تعني اعتماد البيانات. الاعتماد والنشر إلى النموذج المالي سيأتيان بعد تثبيت طبقة المؤسسة والصلاحيات ومسار الحفظ الآمن.</p>
              </>
            ) : <div className="flex min-h-80 items-center justify-center rounded-2xl bg-slate-50 text-center text-sm leading-7 text-slate-500">ارفع ملفًا لعرض نتيجة التحقق والمعاينة هنا</div>}
          </section>
        </div>
      </section>
    </main>
  );
}
