"use client";

import { ChangeEvent, useMemo, useState } from "react";
import "./import.css";
import { createClient } from "@/lib/supabase/client";

type Row = Record<string, string>;
type Mapping = Record<string, string>;

const canonicalFields = [
  { key: "date", label: "التاريخ", required: true },
  { key: "account", label: "الحساب", required: true },
  { key: "amount", label: "المبلغ", required: true },
  { key: "legal_entity", label: "الكيان القانوني", required: false },
  { key: "branch", label: "الفرع", required: false },
  { key: "department", label: "الإدارة", required: false },
  { key: "cost_center", label: "مركز التكلفة", required: false },
  { key: "region", label: "المنطقة", required: false },
  { key: "product", label: "المنتج", required: false },
  { key: "project", label: "المشروع", required: false },
];

function parseCsv(text: string): { headers: string[]; rows: Row[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };

  const split = (line: string) => {
    const values: string[] = [];
    let value = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
      else value += char;
    }
    values.push(value.trim());
    return values;
  };

  const headers = split(lines[0]).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map((line) => {
    const values = split(line);
    return Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]));
  });
  return { headers, rows };
}

function guessMapping(headers: string[]): Mapping {
  const aliases: Record<string, string[]> = {
    date: ["date", "transaction_date", "posting_date", "تاريخ", "التاريخ"],
    account: ["account", "account_code", "account_name", "الحساب", "كود الحساب", "اسم الحساب"],
    amount: ["amount", "value", "balance", "المبلغ", "القيمة"],
    legal_entity: ["legal_entity", "entity", "الكيان", "الكيان القانوني"],
    branch: ["branch", "branch_name", "الفرع"],
    department: ["department", "dept", "الإدارة"],
    cost_center: ["cost_center", "cost centre", "مركز التكلفة"],
    region: ["region", "المنطقة"],
    product: ["product", "المنتج"],
    project: ["project", "المشروع"],
  };
  const result: Mapping = {};
  canonicalFields.forEach(({ key }) => {
    const match = headers.find((header) => aliases[key]?.includes(header));
    if (match) result[key] = match;
  });
  return result;
}

export default function ActualsImportPage() {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [mapping, setMapping] = useState<Mapping>({});
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const [publishing, setPublishing] = useState(false);
  const [publishedBatch, setPublishedBatch] = useState<{ batch_id: string; row_count: number } | null>(null);

  const validation = useMemo(() => {
    if (!rows.length) return { valid: false, errors: [] as string[] };
    const errors: string[] = [];
    const missing = ["date", "account", "amount"].filter((field) => !headers.includes(field));
    if (missing.length) errors.push(`الأعمدة الأساسية غير موجودة: ${missing.join("، ")}`);
    rows.forEach((row, index) => {
      if (!row.date) errors.push(`الصف ${index + 2}: التاريخ مفقود`);
      if (!row.account) errors.push(`الصف ${index + 2}: الحساب مفقود`);
      if (!row.amount || !Number.isFinite(Number(row.amount.replace(/,/g, "")))) errors.push(`الصف ${index + 2}: المبلغ غير صالح`);
    });
    return { valid: errors.length === 0, errors };
  }, [headers, rows]);

  const mappingValid = useMemo(() => ["date", "account", "amount"].every((key) => Boolean(mapping[key])), [mapping]);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(""); setRows([]); setHeaders([]); setMapping({}); setStage(1); setPublishedBatch(null);
    setFileName(file?.name ?? "");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("النسخة الحالية تقبل CSV فقط. دعم Excel سيُضاف ضمن المرحلة التالية من محرك الاستيراد.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result ?? ""));
        setHeaders(parsed.headers); setRows(parsed.rows); setMapping(guessMapping(parsed.headers));
        if (!parsed.headers.length || !parsed.rows.length) setError("الملف لا يحتوي على بيانات قابلة للمعالجة.");
      } catch { setError("تعذر قراءة الملف. تحقق من أن CSV صالح."); }
    };
    reader.readAsText(file, "UTF-8");
  }

  function updateMapping(field: string, source: string) {
    setMapping((current) => ({ ...current, [field]: source }));
  }

  async function publishImport() {
    setError("");
    setPublishing(true);
    try {
      const supabase = createClient();
      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .limit(1)
        .maybeSingle();
      if (membershipError) throw new Error("تعذر تحديد مساحة العمل الحالية. يجب تسجيل الدخول أولًا.");
      if (!membership?.organization_id) throw new Error("لا توجد مساحة عمل مرتبطة بالمستخدم الحالي.");

      const payload = rows.map((row, index) => {
        const item: Record<string, string | number> = {
          date: row[mapping.date] ?? "",
          account: row[mapping.account] ?? "",
          amount: Number((row[mapping.amount] ?? "").replace(/,/g, "")),
        };
        for (const key of ["legal_entity", "branch", "department", "cost_center", "region", "product", "project"]) {
          const source = mapping[key];
          if (source && row[source]) item[key] = row[source];
        }
        item.source_row = index + 2;
        return item;
      });

      const { data, error: rpcError } = await supabase.rpc("publish_actual_import", {
        target_organization_id: membership.organization_id,
        target_file_name: fileName,
        target_rows: payload,
      });
      if (rpcError) throw new Error(rpcError.message.includes("AUTH_REQUIRED") ? "يجب تسجيل الدخول قبل نشر البيانات الفعلية." : rpcError.message);
      if (!data?.batch_id) throw new Error("لم يرجع محرك الاستيراد رقم الدفعة.");
      setPublishedBatch({ batch_id: data.batch_id, row_count: data.row_count });
      setStage(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر نشر البيانات الفعلية. لم يتم اعتماد البيانات.");
    } finally { setPublishing(false); }
  }

  return (
    <main className="import-page" dir="rtl">
      <header className="import-topbar">
        <div><p>منصة القائد / البيانات الفعلية</p><h1>استيراد البيانات الفعلية</h1></div>
        <a href="/dashboard">العودة للوحة الإدارة</a>
      </header>

      <section className="import-card">
        <div className="step-line">
          <span className={`step ${stage >= 1 ? "active" : ""}`}>1 <b>رفع الملف</b></span>
          <span className={`step ${stage >= 2 ? "active" : ""}`}>2 <b>التحقق</b></span>
          <span className={`step ${stage >= 3 ? "active" : ""}`}>3 <b>الربط</b></span>
          <span className={`step ${stage >= 4 ? "active" : ""}`}>4 <b>النشر</b></span>
        </div>

        <div className="upload-box">
          <div className="upload-icon">↑</div>
          <h2>ارفع ملف البيانات الفعلية</h2>
          <p>الملف لا يُنشر تلقائيًا. يمر بالتحقق والربط ثم يُرسل لمحرك الاستيراد الذري.</p>
          <label className="upload-button">اختيار ملف CSV<input type="file" accept=".csv,text/csv" onChange={handleFile} /></label>
          <small>الصيغة الحالية: CSV UTF-8 — دعم Excel ضمن المرحلة التالية</small>
        </div>

        {fileName && <div className="file-row"><strong>{fileName}</strong><span>{rows.length} صف</span></div>}
        {error && <div className="message error">{error}</div>}

        {rows.length > 0 && (
          <>
            <section className="validation-section">
              <div className="section-title"><div><h2>التحقق الأولي</h2><p>فحص الحقول الأساسية قبل السماح بالربط</p></div><strong className={validation.valid ? "valid" : "invalid"}>{validation.valid ? "صالح للخطوة التالية" : `${validation.errors.length} مشكلة`}</strong></div>
              {!validation.valid && <div className="errors">{validation.errors.slice(0, 20).map((item) => <div key={item}>{item}</div>)}{validation.errors.length > 20 && <div>وأخطاء أخرى لم تُعرض</div>}</div>}
              <div className="preview"><div className="preview-head">{headers.map((header) => <span key={header}>{header}</span>)}</div>{rows.slice(0, 8).map((row, index) => <div className="preview-row" key={index}>{headers.map((header) => <span key={header}>{row[header] || "—"}</span>)}</div>)}</div>
            </section>

            {validation.valid && (
              <section className="validation-section mapping-section">
                <div className="section-title"><div><h2>ربط أعمدة الملف</h2><p>تحويل أعمدة المصدر إلى الحقول المالية القياسية</p></div><strong className={mappingValid ? "valid" : "invalid"}>{mappingValid ? "الحقول الأساسية مربوطة" : "أكمل الحقول الأساسية"}</strong></div>
                <div className="mapping-grid">{canonicalFields.map((field) => <label className="mapping-row" key={field.key}><span>{field.label}{field.required ? " *" : ""}</span><select value={mapping[field.key] ?? ""} onChange={(event) => updateMapping(field.key, event.target.value)}><option value="">غير مربوط</option>{headers.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>)}</div>
                <div className="mapping-note"><strong>قاعدة النشر</strong><span>لا تُنشأ أرقام مالية افتراضية. محرك النشر يقبل فقط الحسابات والفترات والأبعاد الموجودة فعليًا في قاعدة البيانات.</span></div>
                <button className="primary-action" disabled={!mappingValid} onClick={() => setStage(3)}>اعتماد الربط</button>
              </section>
            )}

            {stage === 3 && mappingValid && (
              <section className="validation-section">
                <div className="section-title"><div><h2>نشر البيانات الفعلية</h2><p>سيتم إنشاء Import Batch وإدخال الحقائق المالية داخل معاملة واحدة</p></div><strong className="valid">جاهز للنشر</strong></div>
                <div className="next-note">إذا فشل أي صف في مطابقة الحساب أو الفترة أو أي بُعد مربوط، يفشل الاستيراد ولا تُعتمد دفعة جزئية.</div>
                <button className="primary-action" disabled={publishing} onClick={publishImport}>{publishing ? "جارٍ تنفيذ الاستيراد..." : "نشر البيانات الفعلية"}</button>
              </section>
            )}

            {stage === 4 && publishedBatch && (
              <section className="validation-section">
                <div className="section-title"><div><h2>تم نشر البيانات الفعلية</h2><p>أصبحت الدفعة متاحة لمحركات التحليل ولوحة الإدارة</p></div><strong className="valid">Published</strong></div>
                <div className="next-note">رقم الدفعة: {publishedBatch.batch_id}<br />عدد الصفوف المعتمدة: {publishedBatch.row_count}</div>
                <a className="primary-action" href="/dashboard">فتح لوحة الإدارة</a>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
