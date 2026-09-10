"use client";

import { ChangeEvent, useMemo, useState } from "react";
import "./import.css";

type Row = Record<string, string>;

const required = ["date", "account", "amount"];

function parseCsv(text: string): { headers: string[]; rows: Row[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const split = (line: string) => line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
  const headers = split(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const values = split(line);
    return Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]));
  });
  return { headers, rows };
}

export default function ActualsImportPage() {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  const validation = useMemo(() => {
    if (!rows.length) return { valid: false, errors: [] as string[] };
    const errors: string[] = [];
    const missing = required.filter((field) => !headers.includes(field));
    if (missing.length) errors.push(`الأعمدة المطلوبة غير موجودة: ${missing.join("، ")}`);
    rows.forEach((row, index) => {
      if (!row.date) errors.push(`الصف ${index + 2}: التاريخ مفقود`);
      if (!row.account) errors.push(`الصف ${index + 2}: الحساب مفقود`);
      if (!row.amount || !Number.isFinite(Number(row.amount))) errors.push(`الصف ${index + 2}: المبلغ غير صالح`);
    });
    return { valid: errors.length === 0, errors };
  }, [headers, rows]);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError("");
    setRows([]);
    setHeaders([]);
    setFileName(file?.name ?? "");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("النسخة الحالية تقبل CSV فقط. دعم Excel سيُضاف في مرحلة محرك الاستيراد التالية.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result ?? ""));
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        if (!parsed.headers.length || !parsed.rows.length) setError("الملف لا يحتوي على بيانات قابلة للمعالجة.");
      } catch {
        setError("تعذر قراءة الملف. تحقق من أن CSV صالح.");
      }
    };
    reader.readAsText(file, "UTF-8");
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
          <span className="step active">1 <b>رفع الملف</b></span>
          <span className="step">2 <b>التحقق</b></span>
          <span className="step">3 <b>الربط</b></span>
          <span className="step">4 <b>النشر</b></span>
        </div>

        <div className="upload-box">
          <div className="upload-icon">↑</div>
          <h2>ارفع ملف البيانات الفعلية</h2>
          <p>لن يتم نشر أي بيانات إلى النموذج المالي من هذه الشاشة. الرفع الحالي للمعاينة والتحقق فقط.</p>
          <label className="upload-button">
            اختيار ملف CSV
            <input type="file" accept=".csv,text/csv" onChange={handleFile} />
          </label>
          <small>الصيغة المطلوبة الآن: CSV UTF-8</small>
        </div>

        {fileName && <div className="file-row"><strong>{fileName}</strong><span>{rows.length} صف</span></div>}
        {error && <div className="message error">{error}</div>}

        {rows.length > 0 && (
          <section className="validation-section">
            <div className="section-title">
              <div><h2>نتيجة التحقق الأولي</h2><p>التاريخ والحساب والمبلغ هي الحقول الأساسية في المرحلة الحالية</p></div>
              <strong className={validation.valid ? "valid" : "invalid"}>{validation.valid ? "صالح للخطوة التالية" : `${validation.errors.length} مشكلة`}</strong>
            </div>
            {!validation.valid && <div className="errors">{validation.errors.slice(0, 20).map((item) => <div key={item}>{item}</div>)}{validation.errors.length > 20 && <div>وأخطاء أخرى لم تُعرض</div>}</div>}
            <div className="preview">
              <div className="preview-head">{headers.map((header) => <span key={header}>{header}</span>)}</div>
              {rows.slice(0, 8).map((row, index) => <div className="preview-row" key={index}>{headers.map((header) => <span key={header}>{row[header] || "—"}</span>)}</div>)}
            </div>
            <div className="next-note">الخطوة التالية ستكون ربط أعمدة الملف بحقول النظام ثم إنشاء Import Batch قبل السماح بالنشر.</div>
          </section>
        )}
      </section>
    </main>
  );
}
