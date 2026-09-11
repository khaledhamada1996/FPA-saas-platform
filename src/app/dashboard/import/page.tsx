"use client";

import { ChangeEvent, useMemo, useState } from "react";
import "./import.css";
import { createClient } from "@/lib/supabase/client";

type Row = Record<string, string>;
type Mapping = Record<string, string>;
type MasterItem = { id: string; code: string; name: string };
type MasterData = Record<string, MasterItem[]>;

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

const valueMappingFields = canonicalFields.filter((field) => !["date", "amount"].includes(field.key));
const masterTableByField: Record<string, string> = {
  account: "accounts",
  legal_entity: "legal_entities",
  branch: "branches",
  department: "departments",
  cost_center: "cost_centers",
  region: "regions",
  product: "products",
  project: "projects",
};

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

function normalizeNumber(value: string) {
  const normalized = value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  return Number(normalized);
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
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [publishedBatch, setPublishedBatch] = useState<{ batch_id: string; row_count: number } | null>(null);
  const [masterData, setMasterData] = useState<MasterData>({});
  const [valueMaps, setValueMaps] = useState<Record<string, Record<string, string>>>({});

  const validation = useMemo(() => {
    if (!rows.length) return { valid: false, errors: [] as string[] };
    const errors: string[] = [];
    const missing = ["date", "account", "amount"].filter((field) => !mapping[field]);
    if (missing.length) errors.push(`يجب ربط الحقول الأساسية: ${missing.join("، ")}`);
    rows.forEach((row, index) => {
      const date = mapping.date ? row[mapping.date] : "";
      const account = mapping.account ? row[mapping.account] : "";
      const amount = mapping.amount ? row[mapping.amount] : "";
      if (!date) errors.push(`الصف ${index + 2}: التاريخ مفقود`);
      if (!account) errors.push(`الصف ${index + 2}: الحساب مفقود`);
      if (!amount || !Number.isFinite(normalizeNumber(amount))) errors.push(`الصف ${index + 2}: المبلغ غير صالح`);
    });
    return { valid: errors.length === 0, errors };
  }, [mapping, rows]);

  const mappingValid = useMemo(() => ["date", "account", "amount"].every((key) => Boolean(mapping[key])), [mapping]);

  const sourceValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    valueMappingFields.forEach(({ key }) => {
      const source = mapping[key];
      if (!source) return;
      result[key] = Array.from(new Set(rows.map((row) => row[source]?.trim()).filter(Boolean)));
    });
    return result;
  }, [mapping, rows]);

  const valueMappingValid = useMemo(() => {
    for (const field of valueMappingFields) {
      const values = sourceValues[field.key] ?? [];
      if (!values.length) continue;
      const fieldMap = valueMaps[field.key] ?? {};
      if (values.some((value) => !fieldMap[value])) return false;
    }
    return true;
  }, [sourceValues, valueMaps]);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(""); setRows([]); setHeaders([]); setMapping({}); setStage(1); setPublishedBatch(null); setMasterData({}); setValueMaps({});
    setFileName(file?.name ?? "");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("النسخة الحالية تقبل CSV فقط. دعم Excel سيُضاف بعد تثبيت محرك CSV بنفس قواعد الدقة.");
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

  async function loadMasterData() {
    setError("");
    setLoadingMasters(true);
    try {
      const supabase = createClient();
      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .limit(1)
        .maybeSingle();
      if (membershipError || !membership?.organization_id) throw new Error("تعذر تحديد مساحة العمل الحالية. يجب تسجيل الدخول أولًا.");

      const next: MasterData = {};
      for (const field of valueMappingFields) {
        const table = masterTableByField[field.key];
        const { data, error: queryError } = await supabase.from(table).select("id,code,name").eq("organization_id", membership.organization_id).order("code");
        if (queryError) throw new Error(`تعذر تحميل ${field.label}: ${queryError.message}`);
        next[field.key] = (data ?? []) as MasterItem[];
      }
      setMasterData(next);

      const autoMaps: Record<string, Record<string, string>> = {};
      for (const field of valueMappingFields) {
        const items = next[field.key] ?? [];
        const map: Record<string, string> = {};
        for (const source of sourceValues[field.key] ?? []) {
          const match = items.find((item) => item.code === source || item.name === source);
          if (match) map[source] = match.code;
        }
        autoMaps[field.key] = map;
      }
      setValueMaps(autoMaps);
      setStage(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل القيم المرجعية.");
    } finally { setLoadingMasters(false); }
  }

  function updateValueMap(field: string, source: string, target: string) {
    setValueMaps((current) => ({
      ...current,
      [field]: { ...(current[field] ?? {}), [source]: target },
    }));
  }

  async function publishImport() {
    setError("");
    setPublishing(true);
    try {
      if (!valueMappingValid) throw new Error("يجب تعيين كل قيمة مصدر ظهرت في الملف إلى قيمة معتمدة قبل النشر.");
      const supabase = createClient();
      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .limit(1)
        .maybeSingle();
      if (membershipError || !membership?.organization_id) throw new Error("يجب تسجيل الدخول وتحديد مساحة العمل قبل النشر.");

      const payload = rows.map((row, index) => {
        const item: Record<string, string | number> = {
          date: row[mapping.date] ?? "",
          account: valueMaps.account?.[row[mapping.account] ?? ""] ?? "",
          amount: normalizeNumber(row[mapping.amount] ?? ""),
          source_row: index + 2,
        };
        for (const key of ["legal_entity", "branch", "department", "cost_center", "region", "product", "project"]) {
          const sourceColumn = mapping[key];
          const sourceValue = sourceColumn ? row[sourceColumn]?.trim() : "";
          if (sourceValue) item[key] = valueMaps[key]?.[sourceValue] ?? "";
        }
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
          <span className={`step ${stage >= 3 ? "active" : ""}`}>3 <b>مطابقة القيم</b></span>
          <span className={`step ${stage >= 4 ? "active" : ""}`}>4 <b>النشر</b></span>
        </div>

        <section className="validation-section">
          <div className="section-title">
            <div><h2>طرق إدخال البيانات</h2><p>اختر المسار المناسب ثم مرر البيانات عبر نفس محرك التحقق والمطابقة</p></div>
          </div>
          <div className="mapping-grid">
            <div className="value-map-block"><div className="value-map-title"><strong>قوالب القائد</strong></div><p>نزّل قالب القيود اليومية أو شجرة الحسابات، أدخل بياناتك، ثم ارفع الملف.</p><a className="primary-action" href="/dashboard/import/templates">فتح القوالب</a></div>
            <div className="value-map-block"><div className="value-map-title"><strong>إدخال يدوي</strong></div><p>إدخال مضبوط باستخدام القيم المرجعية بدل الكتابة الحرة.</p><a className="primary-action" href="/dashboard/import/manual">فتح الإدخال اليدوي</a></div>
          </div>
          <div className="mapping-note"><strong>تكاملات الأنظمة</strong><span>الربط مع الأنظمة المحاسبية سيستخدم نفس النموذج المالي الموحد ولن يتجاوز التحقق والمطابقة.</span></div>
        </section>

        <div className="upload-box">
          <div className="upload-icon">↑</div>
          <h2>ارفع ملف البيانات الفعلية</h2>
          <p>لن نُسقط البيانات مباشرة. كل عمود وكل قيمة مرجعية تمر بالمراجعة قبل اعتمادها.</p>
          <label className="upload-button">اختيار ملف CSV<input type="file" accept=".csv,text/csv" onChange={handleFile} /></label>
          <small>CSV UTF-8 — البيانات تمر بنفس قواعد التحقق والمطابقة قبل النشر</small>
        </div>

        {fileName && <div className="file-row"><strong>{fileName}</strong><span>{rows.length} صف</span></div>}
        {error && <div className="message error">{error}</div>}

        {rows.length > 0 && (
          <>
            <section className="validation-section">
              <div className="section-title"><div><h2>التحقق الأولي</h2><p>فحص التاريخ والحساب والمبلغ لكل صف</p></div><strong className={validation.valid ? "valid" : "invalid"}>{validation.valid ? "صالح" : `${validation.errors.length} مشكلة`}</strong></div>
              {!validation.valid && <div className="errors">{validation.errors.slice(0, 20).map((item) => <div key={item}>{item}</div>)}{validation.errors.length > 20 && <div>وأخطاء أخرى لم تُعرض</div>}</div>}
              <div className="preview"><div className="preview-head">{headers.map((header) => <span key={header}>{header}</span>)}</div>{rows.slice(0, 8).map((row, index) => <div className="preview-row" key={index}>{headers.map((header) => <span key={header}>{row[header] || "—"}</span>)}</div>)}</div>
            </section>

            {validation.valid && (
              <section className="validation-section mapping-section">
                <div className="section-title"><div><h2>ربط الأعمدة</h2><p>مثل Odoo: نحدد معنى كل عمود قبل أن نلمس البيانات المالية</p></div><strong className={mappingValid ? "valid" : "invalid"}>{mappingValid ? "مكتمل" : "أكمل الحقول الأساسية"}</strong></div>
                <div className="mapping-grid">{canonicalFields.map((field) => <label className="mapping-row" key={field.key}><span>{field.label}{field.required ? " *" : ""}</span><select value={mapping[field.key] ?? ""} onChange={(event) => updateMapping(field.key, event.target.value)}><option value="">غير مربوط</option>{headers.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>)}</div>
                <div className="mapping-note"><strong>قاعدة الدقة</strong><span>الربط لا يعني قبول القيمة نفسها. بعد هذه الخطوة سنطابق كل قيمة مصدر مع قيمة موجودة فعليًا في شجرة الحسابات والأبعاد.</span></div>
                <button className="primary-action" disabled={!mappingValid || loadingMasters} onClick={loadMasterData}>{loadingMasters ? "جارٍ تحميل القيم المرجعية..." : "مراجعة القيم ومطابقتها"}</button>
              </section>
            )}

            {stage === 3 && mappingValid && (
              <section className="validation-section mapping-section">
                <div className="section-title"><div><h2>مطابقة القيم — خطوة الدقة</h2><p>كل قيمة ظهرت في الملف يجب أن تُربط بقيمة معتمدة. لا يوجد تخمين صامت.</p></div><strong className={valueMappingValid ? "valid" : "invalid"}>{valueMappingValid ? "كل القيم مربوطة" : "توجد قيم تحتاج قرارًا"}</strong></div>
                {valueMappingFields.map((field) => {
                  const values = sourceValues[field.key] ?? [];
                  if (!values.length) return null;
                  const items = masterData[field.key] ?? [];
                  return <div className="value-map-block" key={field.key}>
                    <div className="value-map-title"><strong>{field.label}</strong><span>{values.length} قيمة مختلفة</span></div>
                    {values.map((source) => <label className="mapping-row" key={`${field.key}-${source}`}><span title={source}>{source}</span><select value={valueMaps[field.key]?.[source] ?? ""} onChange={(event) => updateValueMap(field.key, source, event.target.value)}><option value="">اختر القيمة المعتمدة</option>{items.map((item) => <option value={item.code} key={item.id}>{item.code} — {item.name}</option>)}</select></label>)}
                    {!items.length && <div className="next-note">لا توجد قيم معتمدة في {field.label}. يجب إعدادها أولًا بدل إنشاء قيم تلقائية.</div>}
                  </div>;
                })}
                <div className="mapping-note"><strong>منع الخطأ</strong><span>لن يسمح النظام بالنشر إذا بقيت أي قيمة بدون مطابقة أو إذا لم يوجد الحساب أو الفترة أو البعد في قاعدة البيانات.</span></div>
                <button className="primary-action" disabled={!valueMappingValid} onClick={() => setStage(4)}>اعتماد المطابقة والانتقال للنشر</button>
              </section>
            )}

            {stage === 4 && publishedBatch === null && (
              <section className="validation-section">
                <div className="section-title"><div><h2>المراجعة النهائية</h2><p>لا توجد أرقام افتراضية. النشر ذري: إما كل الصفوف أو لا شيء.</p></div><strong className={valueMappingValid ? "valid" : "invalid"}>{valueMappingValid ? "جاهز" : "غير جاهز"}</strong></div>
                <div className="next-note">عدد الصفوف التي ستُرسل: {rows.length}<br />سيتم التحقق مرة أخرى داخل قاعدة البيانات من الحسابات والفترات والأبعاد قبل الاعتماد.</div>
                <button className="primary-action" disabled={!valueMappingValid || publishing} onClick={publishImport}>{publishing ? "جارٍ تنفيذ الاستيراد..." : "نشر البيانات الفعلية"}</button>
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
