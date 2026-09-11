"use client";

import * as XLSX from "xlsx";
import "../import.css";

type TemplateKey = "actuals" | "accounts" | "budget";
type Template = { key: TemplateKey; title: string; description: string; required: string[]; optional: string[] };

const templates: Template[] = [
  { key: "actuals", title: "قالب قيود اليومية", description: "القالب الأساسي لإدخال البيانات الفعلية. كل قيد يتكون من سطر أو أكثر ويجب أن يتساوى إجمالي المدين مع إجمالي الدائن.", required: ["التاريخ", "رقم القيد", "الحساب", "مدين", "دائن"], optional: ["وصف القيد", "الكيان القانوني", "الفرع", "الإدارة", "مركز التكلفة", "المنطقة", "المشروع"] },
  { key: "accounts", title: "قالب شجرة الحسابات", description: "لتجهيز أو نقل دليل الحسابات قبل استيراد قيود اليومية.", required: ["كود الحساب", "اسم الحساب", "نوع الحساب", "القائمة المالية"], optional: ["الحساب الأب", "الرصيد الطبيعي"] },
  { key: "budget", title: "قالب الموازنة", description: "لإدخال الموازنة الشهرية تمهيدًا للمقارنة مع الفعلي والـ Forecast.", required: ["السنة", "الشهر", "كود الحساب", "الموازنة"], optional: ["اسم الحساب", "الفرع", "مركز التكلفة", "ملاحظات"] },
];

const actualHeaders = ["التاريخ", "رقم القيد", "وصف القيد", "كود الحساب", "اسم الحساب", "مدين", "دائن", "الكيان القانوني", "الفرع", "الإدارة", "مركز التكلفة", "المنطقة", "المشروع"];
const accountHeaders = ["كود الحساب", "اسم الحساب", "نوع الحساب", "القائمة المالية", "الحساب الأب", "الرصيد الطبيعي"];
const budgetHeaders = ["السنة", "الشهر", "كود الحساب", "اسم الحساب", "الفرع", "مركز التكلفة", "الموازنة", "ملاحظات"];

function makeInstructionSheet(template: TemplateKey) {
  const base = [
    ["قالب منصة القائد المالية"],
    ["هذه الورقة تشرح المطلوب قبل تعبئة البيانات."],
    ["مهم", "لا تغيّر أسماء الأعمدة في ورقة البيانات."],
    ["مهم", "لا تضع بيانات تجريبية أو أرقامًا تقديرية في ملف سترفعه للإنتاج."],
    ["الدقة", "كل قيد يومية يجب أن يكون متوازنًا: إجمالي المدين = إجمالي الدائن."],
  ];
  if (template === "actuals") base.push(
    ["الغرض", "إدخال قيود اليومية التي تمثل البيانات الفعلية للمنشأة."],
    ["المطلوب", "التاريخ + رقم القيد + الحساب + مدين + دائن."],
    ["مدين ودائن", "في كل سطر ضع قيمة في مدين أو دائن فقط. لا تضع قيمتين في نفس السطر ولا تتركهما صفرًا معًا."],
    ["رقم القيد", "يجب أن يكون موحدًا لكل سطور القيد الواحد حتى يستطيع النظام تجميعه وفحص توازنه."],
    ["الحساب", "استخدم كود الحساب أو اسم الحساب. ستتم مطابقة الحساب مع شجرة الحسابات قبل النشر."],
    ["الأبعاد", "الكيان والفرع والإدارة ومركز التكلفة والمنطقة والمشروع اختيارية حسب احتياج المنشأة. المنتج غير موجود في قالب قيود اليومية."],
    ["مهم", "لا يتم نشر أي قيد غير متوازن."],
  );
  if (template === "accounts") base.push(
    ["الغرض", "تجهيز شجرة الحسابات التي ستُستخدم في التحليل والقوائم والتصنيف المالي."],
    ["المطلوب", "كود الحساب + اسم الحساب + نوع الحساب + القائمة المالية."],
    ["الحساب الأب", "اختياري، ويُستخدم لبناء التسلسل الهرمي للحسابات."],
    ["الرصيد الطبيعي", "اختياري، واستخدم مدين أو دائن فقط."],
  );
  if (template === "budget") base.push(
    ["الغرض", "إدخال الموازنة الشهرية لاستخدامها لاحقًا في Actual vs Budget وForecast."],
    ["المطلوب", "السنة + الشهر + كود الحساب + الموازنة."],
    ["الشهر", "استخدم رقم الشهر من 1 إلى 12."],
    ["الموازنة", "استخدم قيمة رقمية فقط بدون رمز العملة."],
    ["الأبعاد", "الفرع ومركز التكلفة اختياريان."],
  );
  base.push(["بعد التعبئة", "احفظ الملف بصيغة XLSX ثم ارجع إلى الاستيراد وارفعه. لا يتم اعتماد أي رقم قبل التحقق."]);
  return base;
}

function makeColumnsSheet(template: TemplateKey) {
  const t = templates.find((x) => x.key === template)!;
  const headers = template === "actuals" ? actualHeaders : template === "accounts" ? accountHeaders : budgetHeaders;
  return [["الحقل", "الحالة", "ما المطلوب من المستخدم"], ...headers.map((header) => [header, t.required.includes(header) ? "مطلوب" : "اختياري", t.required.includes(header) ? "يجب تعبئته قبل الرفع" : "يمكن تركه فارغًا إذا لم تستخدمه المنشأة"])];
}

function setSheetLayout(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((wch) => ({ wch }));
  ws["!sheetViews"] = [{ rightToLeft: true }];
}
function addBlankRows(headers: string[], count = 30) { return [headers, ...Array.from({ length: count }, () => headers.map(() => ""))]; }

function download(key: TemplateKey) {
  const wb = XLSX.utils.book_new();
  const instructions = XLSX.utils.aoa_to_sheet(makeInstructionSheet(key));
  const columns = XLSX.utils.aoa_to_sheet(makeColumnsSheet(key));
  const headers = key === "actuals" ? actualHeaders : key === "accounts" ? accountHeaders : budgetHeaders;
  let dataSheet: XLSX.WorkSheet; let dataName: string; let widths: number[];
  if (key === "actuals") { dataSheet = XLSX.utils.aoa_to_sheet(addBlankRows(actualHeaders)); dataName = "قيود اليومية"; widths = [14, 16, 28, 18, 30, 16, 16, 22, 20, 20, 22, 18, 20]; }
  else if (key === "accounts") { dataSheet = XLSX.utils.aoa_to_sheet(addBlankRows(accountHeaders)); dataName = "شجرة الحسابات"; widths = [18, 30, 20, 22, 20, 18]; }
  else { dataSheet = XLSX.utils.aoa_to_sheet(addBlankRows(budgetHeaders)); dataName = "الموازنة"; widths = [12, 12, 18, 30, 20, 22, 18, 30]; }
  setSheetLayout(instructions, [18, 90, 28]); setSheetLayout(columns, [24, 16, 70]); setSheetLayout(dataSheet, widths);
  instructions["!freeze"] = { xSplit: 0, ySplit: 1 }; columns["!freeze"] = { xSplit: 0, ySplit: 1 }; dataSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  dataSheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}31` };
  XLSX.utils.book_append_sheet(wb, instructions, "تعليمات"); XLSX.utils.book_append_sheet(wb, columns, "شرح الحقول"); XLSX.utils.book_append_sheet(wb, dataSheet, dataName);
  XLSX.writeFile(wb, `AlQaed-${key}-template.xlsx`);
}

export default function ImportTemplatesPage() {
  return <main className="import-page" dir="rtl">
    <header className="import-topbar"><div><p>منصة القائد / الاستيراد</p><h1>قوالب Excel</h1></div><a href="/dashboard/import">العودة للاستيراد</a></header>
    <section className="import-card">
      <section className="validation-section"><div className="section-title"><div><h2>ابدأ من القالب المناسب لك</h2><p>قالب قيود اليومية هو المسار الأساسي للبيانات الفعلية، مع فصل واضح بين المدين والدائن وإمكانية استخدام الأبعاد التحليلية عند الحاجة.</p></div></div>
        <div className="mapping-grid">{templates.map((t) => <div className="value-map-block" key={t.key}><div className="value-map-title"><strong>{t.title}</strong><span>XLSX</span></div><p>{t.description}</p><p><strong>مطلوب:</strong> {t.required.join("، ")}</p><p><strong>اختياري:</strong> {t.optional.join("، ")}</p><button className="primary-action" onClick={() => download(t.key)}>تحميل Excel</button></div>)}</div>
      </section>
      <div className="mapping-note"><strong>قاعدة الدقة</strong><span>قيود اليومية لا تستخدم عمود مبلغ واحد. لكل سطر مدين أو دائن، ولكل رقم قيد يجب أن يتساوى مجموع المدين مع مجموع الدائن قبل النشر.</span></div>
    </section>
  </main>;
}
