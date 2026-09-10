"use client";

import { ChangeEvent, useMemo, useState } from "react";
import "./import.css";

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
        if (quoted && line[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === "," && !quoted) {
        values.push(value.trim());
        value = "";
      } else {
        value += char;
      }
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
    amount: ["amount", "value", "balance", "debit", "credit", "المبلغ", "القيمة"],
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
  const [stage, setStage] = useState<1 | 2 | 3>(1);

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

  const mappingValid = useMemo(
    () => ["date", "account", "amount"].every((key) => Boolean(mapping[key])),
    [mapping],
  );

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError("");
    setRows([]);
    setHeaders([]);
    setMapping({});
    setStage(1);
    setFileName(file?.name ?? "");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("النسخة الحالية تقبل CSV فقط. دعم Excel سيُضاف ضمن محرك الاستيراد.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result ?? ""));
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setMapping(guessMapping(parsed.headers));
        if (!parsed.headers.length || !parsed.rows.length) setError("الملف لا يحتوي على بيانات قابلة للمعالجة.");
      } catch {
        setError("تعذر قراءة الملف. تحقق من أن CSV صالح.");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function updateMapping(field: string, source: string) {
    setMapping((current) => ({ ...current, [field]: source }));
  }

  return (
    <main className="import-page" dir="rtl">
      <header className="import-topbar">
        <div>
          <p>منصة القائد / البيانات الفعلية</p>
          <h1>استيراد البيانات الفعلية</h1>
        </div>
        <a href="/dashboard">العودة للوحة الإدارة</a>
      </header>

      <section className="import-card">
        <div className="step-line">
          <span className={`step ${stage >= 1 ? "active" : ""}`}>1 <b>رفع الملف</b></span>
          <span className={`step ${stage >= 2 ? "active" : ""}`}>2 <b>التحقق</b></span>
          <span className={`step ${stage >= 3 ? "active" : ""}`}>3 <b>الربط</b></span>
          <span className="step">4 <b>النشر</b></span>
        </div>

        <div className="upload-box">
          <div className="upload-icon">↑</div>
          <h2>ارفع ملف البيانات الفعلية</h2>
          <p>البيانات لا تُنشر تلقائيًا. تمر أولًا بالتحقق والربط ثم إنشاء Import Batch قبل النشر.</p>
          <label className="upload-button">
            اختيار ملف CSV
            <input type="file" accept=".csv,text/csv" onChange={handleFile} />
          </label>
          <small>الصيغة الحالية: CSV UTF-8 — Excel ضمن المرحلة التالية من محرك الاستيراد</small>
        </div>

        {fileName && <div className="file-row"><strong>{fileName}</strong><span>{rows.length} صف</span></div>}
        {error && <div className="message error">{error}</div>}

        {rows.length > 0 && (
          <>
            <section className="validation-section">
              <div className="section-title">
                <div><h2>التحقق الأولي</h2><p>يتم فحص الحقول الأساسية قبل السماح بالربط</p></div>
                <strong className={validation.valid ? "valid" : "invalid"}>{validation.valid ? "صالح للخطوة التالية" : `${validation.errors.length} مشكلة`}</strong>
              </div>
              {!validation.valid && <div className="errors">{validation.errors.slice(0, 20).map((item) => <div key={item}>{item}</div>)}{validation.errors.length > 20 && <div>وأخطاء أخرى لم تُعرض</div>}</div>}
              <div className="preview">
                <div className="preview-head">{headers.map((header) => <span key={header}>{header}</span>)}</div>
                {rows.slice(0, 8).map((row, index) => <div className="preview-row" key={index}>{headers.map((header) => <span key={header}>{row[header] || "—"}</span>)}</div>)}
              </div>
            </section>

            {validation.valid && (
              <section className="validation-section mapping-section">
                <div className="section-title">
                  <div><h2>ربط أعمدة الملف</h2><p>نحدد كيف تتحول أعمدة المصدر إلى الحقول المالية القياسية داخل النموذج</p></div>
                  <strong className={mappingValid ? "valid" : "invalid"}>{mappingValid ? "الحقول الأساسية مربوطة" : "أكمل الحقول الأساسية"}</strong>
                </div>
                <div className="mapping-grid">
                  {canonicalFields.map((field) => (
                    <label className="mapping-row" key={field.key}>
                      <span>{field.label}{field.required ? " *" : ""}</span>
                      <select value={mapping[field.key] ?? ""} onChange={(event) => updateMapping(field.key, event.target.value)}>
                        <option value="">غير مربوط</option>
                        {headers.map((header) => <option value={header} key={header}>{header}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="mapping-note">
                  <strong>ملاحظة مهمة</strong>
                  <span>الربط هنا يحدد البنية فقط. لم يتم بعد إنشاء حسابات أو فترات أو قيود مالية في قاعدة البيانات.</span>
                </div>
                <button className="primary-action" disabled={!mappingValid} onClick={() => setStage(3)}>اعتماد الربط والانتقال لمحرك الاستيراد</button>
              </section>
            )}

            {stage === 3 && mappingValid && (
              <section className="validation-section">
                <div className="section-title">
                  <div><h2>جاهز لإنشاء Import Batch</h2><p>المرحلة التالية ستنشئ دفعة استيراد وتتحقق من الحسابات والفترات والأبعاد قبل إدخال الحقائق المالية</p></div>
                  <strong className="valid">الربط مكتمل</strong>
                </div>
                <div className="next-note">لم يتم الحفظ أو النشر بعد. الخطوة التالية برمجية: ربط الحسابات والفترات والأبعاد بقاعدة البيانات ثم تنفيذ الاستيراد بشكل ذري مع تقرير reconciliation.</div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
