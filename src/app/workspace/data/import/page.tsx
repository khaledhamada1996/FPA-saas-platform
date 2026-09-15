"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

type NormalizedRow = {
  date: string;
  journal_no: string;
  description: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  document_no?: string;
  document_type?: string;
  currency?: string;
  exchange_rate?: number;
  legal_entity?: string;
  branch?: string;
  department?: string;
  cost_center?: string;
  region?: string;
  product?: string;
  project?: string;
  line_no: number;
};

const aliases: Record<string, string[]> = {
  date: ["date", "transaction_date", "posting_date", "financial_period", "التاريخ", "تاريخ", "تاريخ الحركة", "تاريخ القيد"],
  journal_no: ["journal_no", "journal_number", "journal", "transaction_ref", "transaction_id", "رقم القيد", "رقم الحركة", "المرجع"],
  description: ["description", "narration", "memo", "details", "البيان", "الوصف", "وصف القيد", "البيان المحاسبي"],
  account_code: ["account_code", "account", "account_number", "gl_account", "رقم الحساب", "كود الحساب", "الحساب"],
  account_name: ["account_name", "account_title", "gl_account_name", "اسم الحساب", "اسم الحساب المالي"],
  debit: ["debit", "debits", "مدين", "المدين"],
  credit: ["credit", "credits", "دائن", "الدائن"],
  document_no: ["document_no", "document_number", "doc_no", "رقم المستند"],
  document_type: ["document_type", "doc_type", "نوع المستند"],
  currency: ["currency", "العملة"],
  exchange_rate: ["exchange_rate", "fx_rate", "سعر الصرف"],
  legal_entity: ["legal_entity", "entity", "الشركة", "الكيان القانوني"],
  branch: ["branch", "الفرع"],
  department: ["department", "الإدارة", "القسم"],
  cost_center: ["cost_center", "مركز التكلفة"],
  region: ["region", "المنطقة"],
  product: ["product", "المنتج"],
  project: ["project", "المشروع"],
};

const normalizeHeader = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[\s\-_./]+/g, "_");
const text = (value: unknown) => String(value ?? "").trim();
const number = (value: unknown) => {
  const raw = text(value).replace(/\u00a0/g, " ").replace(/,/g, "").replace(/٬/g, "").trim();
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
};

function findColumn(headers: string[], field: string) {
  const wanted = new Set((aliases[field] ?? []).map(normalizeHeader));
  return headers.find((header) => wanted.has(normalizeHeader(header)));
}

function excelDate(value: unknown) {
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return `${date.y.toString().padStart(4, "0")}-${date.m.toString().padStart(2, "0")}-${date.d.toString().padStart(2, "0")}`;
  }
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return raw;
}

export default function ImportPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<NormalizedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileError, setFileError] = useState("");
  const [sheet, setSheet] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState<"select" | "validate" | "ready">("select");

  const totals = useMemo(() => ({
    debit: rows.reduce((sum, row) => sum + row.debit, 0),
    credit: rows.reduce((sum, row) => sum + row.credit, 0),
  }), [rows]);

  const parseFile = async (selected: File) => {
    setLoading(true);
    setFileError("");
    setErrors([]);
    setWarnings([]);
    setRows([]);
    try {
      const extension = selected.name.toLowerCase().split(".").pop();
      if (extension !== "csv" && extension !== "xlsx") throw new Error("صيغة الملف غير مدعومة. استخدم CSV أو XLSX.");
      const buffer = await selected.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
      if (!workbook.SheetNames.length) throw new Error("الملف لا يحتوي على ورقة بيانات.");
      const selectedSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[selectedSheet];
      const raw = XLSX.utils.sheet_to_json<Row>(worksheet, { defval: "", raw: true });
      if (!raw.length) throw new Error("الورقة المختارة لا تحتوي على بيانات.");
      const headers = Object.keys(raw[0]);
      const columns: Record<string, string | undefined> = {};
      for (const field of Object.keys(aliases)) columns[field] = findColumn(headers, field);

      const required = ["date", "journal_no", "description", "account_code", "account_name", "debit", "credit"];
      const missing = required.filter((field) => !columns[field]);
      if (missing.length) {
        const labels: Record<string, string> = { date: "التاريخ", journal_no: "رقم القيد", description: "البيان", account_code: "رقم الحساب", account_name: "اسم الحساب", debit: "المدين", credit: "الدائن" };
        throw new Error(`تعذر اكتشاف الأعمدة المطلوبة: ${missing.map((field) => labels[field]).join("، ")}`);
      }

      const nextErrors: string[] = [];
      const nextWarnings: string[] = [];
      const normalized: NormalizedRow[] = raw.map((source, index) => {
        const line = index + 2;
        const get = (field: string) => columns[field] ? source[columns[field]!] : "";
        const debit = number(get("debit"));
        const credit = number(get("credit"));
        const row: NormalizedRow = {
          date: excelDate(get("date")),
          journal_no: text(get("journal_no")),
          description: text(get("description")),
          account_code: text(get("account_code")),
          account_name: text(get("account_name")),
          debit,
          credit,
          line_no: index + 1,
        };
        for (const field of ["document_no", "document_type", "currency", "legal_entity", "branch", "department", "cost_center", "region", "product", "project"] as const) {
          const value = text(get(field));
          if (value) row[field] = value;
        }
        const rate = number(get("exchange_rate"));
        if (columns.exchange_rate && text(get("exchange_rate"))) row.exchange_rate = rate;
        if (!row.date) nextErrors.push(`السطر ${line}: التاريخ مفقود`);
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) nextErrors.push(`السطر ${line}: التاريخ غير صالح`);
        if (!row.journal_no) nextErrors.push(`السطر ${line}: رقم القيد مفقود`);
        if (!row.description) nextErrors.push(`السطر ${line}: البيان مفقود`);
        if (!row.account_code) nextErrors.push(`السطر ${line}: رقم الحساب مفقود`);
        if (!row.account_name) nextErrors.push(`السطر ${line}: اسم الحساب مفقود`);
        if (Number.isNaN(debit) || Number.isNaN(credit)) nextErrors.push(`السطر ${line}: المدين أو الدائن غير صالح`);
        else if (debit < 0 || credit < 0) nextErrors.push(`السطر ${line}: لا يسمح بقيم سالبة`);
        else if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) nextErrors.push(`السطر ${line}: أدخل قيمة مدين أو دائن فقط`);
        if (!text(get("currency")) && !nextWarnings.includes("العملة غير موجودة في الملف؛ ستبقى اختيارية حسب إعدادات الشركة.")) nextWarnings.push("العملة غير موجودة في الملف؛ ستبقى اختيارية حسب إعدادات الشركة.");
        return row;
      });

      const journalTotals = new Map<string, { debit: number; credit: number }>();
      for (const row of normalized) {
        const current = journalTotals.get(row.journal_no) ?? { debit: 0, credit: 0 };
        current.debit += Number.isNaN(row.debit) ? 0 : row.debit;
        current.credit += Number.isNaN(row.credit) ? 0 : row.credit;
        journalTotals.set(row.journal_no, current);
      }
      for (const [journal, total] of journalTotals) {
        if (Math.abs(total.debit - total.credit) > 0.005) nextErrors.push(`القيد ${journal}: غير متوازن بفارق ${Math.abs(total.debit - total.credit).toFixed(2)}`);
      }

      setFile(selected);
      setSheet(selectedSheet);
      setRows(normalized);
      setErrors(nextErrors);
      setWarnings(nextWarnings);
      setStage(nextErrors.length ? "validate" : "ready");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "تعذر قراءة الملف");
      setStage("select");
    } finally {
      setLoading(false);
    }
  };

  const saveImport = async () => {
    if (!file || !rows.length || errors.length) return;
    const organizationId = window.sessionStorage.getItem("activeOrganizationId");
    if (!organizationId) { setFileError("لم يتم تحديد الشركة النشطة"); return; }
    setSaving(true);
    setFileError("");
    try {
      const payload = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined && value !== "")));
      const hashBuffer = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const { data, error } = await getSupabaseBrowserClient().rpc("ingest_validated_import", {
        p_organization_id: organizationId,
        p_file_name: file.name,
        p_file_hash: hash,
        p_rows: payload,
      });
      if (error) throw error;
      if (!data) throw new Error("لم يتم إنشاء عملية الاستيراد");
      router.push(`/workspace/data/${data}`);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "تعذر إنشاء عملية الاستيراد");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div><button type="button" onClick={() => router.push("/workspace/data")} className="text-xs text-slate-500 hover:text-slate-950">مركز البيانات</button><h1 className="mt-1 text-lg font-bold text-slate-950">استيراد بيانات فعلية</h1></div>
          <span className="text-xs font-semibold text-slate-500">المرحلة {stage === "select" ? "1" : "2"} من 3</span>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400">Actual Journal Transactions</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">استيراد القيود اليومية</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">ارفع ملف CSV أو XLSX. سنكتشف الأعمدة، نتحقق من البيانات وتوازن كل قيد، ثم ننقلك إلى المطابقة والمراجعة قبل نشر Actuals.</p>
            </div>
            <button type="button" onClick={() => router.push("/workspace/data/manual")} className="shrink-0 bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800">+ إضافة قيد يومية يدوي</button>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="border border-slate-200 bg-white p-5 sm:p-7">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-bold">
              {["اختيار نوع البيانات", "رفع الملف والتحقق", "المطابقة والمراجعة ثم النشر"].map((label, index) => <span key={label} className={`border px-3 py-2 ${index === 1 ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 text-slate-500"}`}>{index + 1}. {label}</span>)}
            </div>

            <input ref={inputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void parseFile(selected); }} />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={loading || saving} className="w-full border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center hover:border-slate-500 disabled:opacity-50">
              <span className="block text-base font-bold text-slate-950">{loading ? "جارٍ قراءة الملف والتحقق…" : file ? file.name : "اختر ملف CSV أو XLSX"}</span>
              <span className="mt-2 block text-sm text-slate-500">البيانات لا تصبح Actuals بمجرد الرفع؛ النشر يأتي بعد المراجعة والمطابقة.</span>
            </button>

            {fileError && <div className="mt-4 border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">{fileError}</div>}
            {file && !fileError && <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-600"><span className="bg-slate-100 px-3 py-2">الورقة: {sheet}</span><span className="bg-slate-100 px-3 py-2">الصفوف: {rows.length.toLocaleString("ar-SA")}</span><span className="bg-slate-100 px-3 py-2">مدين: {totals.debit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}</span><span className="bg-slate-100 px-3 py-2">دائن: {totals.credit.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}</span></div>}

            {errors.length > 0 && <div className="mt-5 border border-red-200 bg-red-50 p-4"><h3 className="font-bold text-red-800">أخطاء تمنع المتابعة</h3><ul className="mt-2 max-h-56 list-disc space-y-1 overflow-auto pr-5 text-sm leading-6 text-red-700">{errors.slice(0, 100).map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>{errors.length > 100 && <p className="mt-2 text-xs text-red-600">تم عرض أول 100 خطأ فقط.</p>}</div>}
            {warnings.length > 0 && <div className="mt-5 border border-slate-200 bg-slate-50 p-4"><h3 className="font-bold text-slate-800">تنبيهات</h3><ul className="mt-2 list-disc space-y-1 pr-5 text-sm leading-6 text-slate-600">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}

            {rows.length > 0 && <div className="mt-5 overflow-x-auto border border-slate-200"><table className="min-w-[900px] w-full text-xs"><thead className="bg-slate-50 text-slate-600"><tr>{["#", "التاريخ", "رقم القيد", "البيان", "الحساب", "مدين", "دائن"].map((head) => <th key={head} className="border-b border-slate-200 px-3 py-3 text-right">{head}</th>)}</tr></thead><tbody>{rows.slice(0, 10).map((row) => <tr key={`${row.line_no}-${row.journal_no}`} className="border-b border-slate-100"><td className="px-3 py-2 text-slate-400">{row.line_no}</td><td className="px-3 py-2">{row.date}</td><td className="px-3 py-2">{row.journal_no}</td><td className="max-w-[260px] truncate px-3 py-2">{row.description}</td><td className="px-3 py-2">{row.account_code} — {row.account_name}</td><td className="px-3 py-2">{row.debit.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td><td className="px-3 py-2">{row.credit.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td></tr>)}</tbody></table></div>}

            <div className="mt-6 flex flex-wrap justify-between gap-3">
              <button type="button" onClick={() => router.push("/workspace/data")} className="border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700">إلغاء والعودة</button>
              <button type="button" onClick={saveImport} disabled={!file || !rows.length || errors.length > 0 || saving} className="bg-slate-950 px-6 py-3 text-sm font-bold text-white disabled:opacity-40">{saving ? "جارٍ إنشاء عملية الاستيراد…" : "متابعة إلى المطابقة والمراجعة"}</button>
            </div>
          </section>

          <aside className="border border-slate-200 bg-white p-5 h-fit">
            <h3 className="font-bold text-slate-950">ما الذي يدعمه هذا المسار؟</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>✓ CSV و XLSX</li>
              <li>✓ اكتشاف أسماء الأعمدة بالعربية والإنجليزية</li>
              <li>✓ التحقق من الحقول الأساسية</li>
              <li>✓ التحقق من المدين والدائن</li>
              <li>✓ التحقق من توازن كل رقم قيد</li>
              <li>✓ عرض عينة قبل إنشاء الاستيراد</li>
            </ul>
            <div className="mt-5 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500">ميزان المراجعة والميزانية والتوقعات لها عقود بيانات مستقلة في المواصفات، لذلك لا يتم خلطها مع هذا المسار.</div>
          </aside>
        </div>
      </section>
    </main>
  );
}
