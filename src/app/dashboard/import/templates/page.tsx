"use client";

import * as XLSX from "xlsx";
import "../import.css";

type TemplateKey = "actuals" | "accounts" | "budget";

type Template = {
  key: TemplateKey;
  title: string;
  description: string;
  required: string[];
  optional: string[];
};

const templates: Template[] = [
  {
    key: "actuals",
    title: "قالب البيانات الفعلية",
    description: "المسار الأنسب للمستخدم الذي يريد تجهيز بياناته ثم رفعها للمنصة. الأعمدة مطابقة مباشرة لمحرك الاستيراد الحالي.",
    required: ["التاريخ", "الحساب", "المبلغ"],
    optional: ["الكيان القانوني", "الفرع", "الإدارة", "مركز التكلفة", "المنطقة", "المنتج", "المشروع"],
  },
  {
    key: "accounts",
    title: "قالب شجرة الحسابات",
    description: "لتجهيز أو نقل دليل الحسابات قبل استيراد البيانات الفعلية، مع تعريف نوع الحساب والقائمة المالية.",
    required: ["كود الحساب", "اسم الحساب", "نوع الحساب", "القائمة المالية"],
    optional: ["الحساب الأب", "الرصيد الطبيعي"],
  },
  {
    key: "budget",
    title: "قالب الموازنة",
    description: "لإدخال الموازنة على مستوى الشهر والحساب والأبعاد، تمهيدًا للمقارنة مع الفعلي والـ Forecast.",
    required: ["السنة", "الشهر", "كود الحساب", "الموازنة"],
    optional: ["اسم الحساب", "الفرع", "مركز التكلفة", "ملاحظات"],
  },
];

const actualHeaders = [
  "التاريخ",
  "الحساب",
  "المبلغ",
  "الكيان القانوني",
  "الفرع",
  "الإدارة",
  "مركز التكلفة",
  "المنطقة",
  "المنتج",
  "المشروع",
];

const accountHeaders = [
  "كود الحساب",
  "اسم الحساب",
  "نوع الحساب",
  "القائمة المالية",
  "الحساب الأب",
  "الرصيد الطبيعي",
];

const budgetHeaders = [
  "السنة",
  "الشهر",
  "كود الحساب",
  "اسم الحساب",
  "الفرع",
  "مركز التكلفة",
  "الموازنة",
  "ملاحظات",
];

function makeInstructionSheet(template: TemplateKey) {
  const base = [
    ["قالب منصة القائد المالية"],
    ["هذه الورقة تشرح المطلوب قبل تعبئة البيانات."],
    ["مهم", "لا تغيّر أسماء الأعمدة في ورقة البيانات."],
    ["مهم", "لا تحذف الأعمدة الاختيارية حتى لو لم تكن منشأتك تستخدمها."],
    ["مهم", "لا تضع بيانات تجريبية أو أرقامًا تقديرية في ملف سترفعه للإنتاج."],
    ["الدقة", "بعد الرفع ستقوم المنصة بالتحقق من الحقول ثم مطابقة القيم مع البيانات المعتمدة قبل النشر."],
  ];

  if (template === "actuals") {
    base.push(
      ["الغرض", "إدخال البيانات المالية الفعلية التي ستظهر في محركات FP&A والتقارير."],
      ["المطلوب", "التاريخ + الحساب + المبلغ."],
      ["الحساب", "يمكن كتابة كود الحساب أو اسم الحساب. المنصة تحاول المطابقة تلقائيًا ثم تطلب منك تأكيد القيم غير المطابقة."],
      ["المبلغ", "استخدم رقمًا ماليًا واضحًا. يمكن استخدام الأرقام العربية أو الإنجليزية والفواصل، ولا تستخدم رموز العملات داخل الخلية."],
      ["الأبعاد", "الكيان والفرع والإدارة ومركز التكلفة والمنطقة والمنتج والمشروع اختيارية حسب احتياج منشأتك."],
      ["التاريخ", "استخدم تاريخًا حقيقيًا داخل الفترة المالية التي تريد تحميلها."],
      ["قبل الرفع", "تأكد من عدم وجود صفوف فارغة داخل البيانات وعدم تكرار الرؤوس."],
    );
  }

  if (template === "accounts") {
    base.push(
      ["الغرض", "تجهيز شجرة الحسابات التي ستُستخدم في التحليل والقوائم والتصنيف المالي."],
      ["المطلوب", "كود الحساب + اسم الحساب + نوع الحساب + القائمة المالية."],
      ["نوع الحساب", "استخدم التصنيف الفعلي المعتمد في منشأتك ولا تخترع تصنيفًا للحساب."],
      ["القائمة المالية", "حدد هل الحساب مرتبط بقائمة المركز المالي أم قائمة الدخل وفق هيكل منشأتك."],
      ["الحساب الأب", "اختياري، ويُستخدم لبناء التسلسل الهرمي للحسابات."],
      ["الرصيد الطبيعي", "اختياري، واستخدم مدين أو دائن فقط."],
    );
  }

  if (template === "budget") {
    base.push(
      ["الغرض", "إدخال الموازنة الشهرية لاستخدامها لاحقًا في Actual vs Budget وForecast."],
      ["المطلوب", "السنة + الشهر + كود الحساب + الموازنة."],
      ["الشهر", "استخدم رقم الشهر من 1 إلى 12."],
      ["الموازنة", "استخدم قيمة رقمية فقط بدون رمز العملة."],
      ["الأبعاد", "الفرع ومركز التكلفة اختياريان، لكن يفضل تعبئتهما إذا كانت الموازنة مبنية عليهما."],
    );
  }

  base.push(
    ["بعد التعبئة", "احفظ الملف بصيغة XLSX ثم ارجع إلى الاستيراد وارفعه. لا تحتاج إلى تعديل الملف بعد الرفع إلا إذا ظهرت ملاحظات تحقق."],
  );

  return base;
}

function makeColumnsSheet(template: TemplateKey) {
  const t = templates.find((x) => x.key === template)!;
  const headers = template === "actuals" ? actualHeaders : template === "accounts" ? accountHeaders : budgetHeaders;
  return [
    ["الحقل", "الحالة", "ما المطلوب من المستخدم"],
    ...headers.map((header) => [
      header,
      t.required.includes(header) ? "مطلوب" : "اختياري",
      t.required.includes(header)
        ? "يجب تعبئته قبل الرفع"
        : "يمكن تركه فارغًا إذا لم تستخدمه منشأتك",
    ]),
  ];
}

function setSheetLayout(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((wch) => ({ wch }));
  ws["!sheetViews"] = [{ rightToLeft: true }];
}

function addBlankRows(headers: string[], count = 30) {
  return [headers, ...Array.from({ length: count }, () => headers.map(() => ""))];
}

function download(key: TemplateKey) {
  const wb = XLSX.utils.book_new();
  const instructions = XLSX.utils.aoa_to_sheet(makeInstructionSheet(key));
  const columns = XLSX.utils.aoa_to_sheet(makeColumnsSheet(key));

  let dataSheet: XLSX.WorkSheet;
  let dataName: string;
  let widths: number[];

  if (key === "actuals") {
    dataSheet = XLSX.utils.aoa_to_sheet(addBlankRows(actualHeaders));
    dataName = "البيانات الفعلية";
    widths = [14, 24, 16, 22, 20, 20, 22, 18, 20, 20];
  } else if (key === "accounts") {
    dataSheet = XLSX.utils.aoa_to_sheet(addBlankRows(accountHeaders));
    dataName = "شجرة الحسابات";
    widths = [18, 30, 20, 22, 20, 18];
  } else {
    dataSheet = XLSX.utils.aoa_to_sheet(addBlankRows(budgetHeaders));
    dataName = "الموازنة";
    widths = [12, 12, 18, 30, 20, 22, 18, 30];
  }

  setSheetLayout(instructions, [18, 85, 28]);
  setSheetLayout(columns, [24, 16, 70]);
  setSheetLayout(dataSheet, widths);
  instructions["!freeze"] = { xSplit: 0, ySplit: 1 };
  columns["!freeze"] = { xSplit: 0, ySplit: 1 };
  dataSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  dataSheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col((key === "actuals" ? actualHeaders : key === "accounts" ? accountHeaders : budgetHeaders).length - 1)}31` };

  XLSX.utils.book_append_sheet(wb, instructions, "تعليمات");
  XLSX.utils.book_append_sheet(wb, columns, "شرح الحقول");
  XLSX.utils.book_append_sheet(wb, dataSheet, dataName);

  XLSX.writeFile(wb, `AlQaed-${key}-template.xlsx`);
}

export default function ImportTemplatesPage() {
  return (
    <main className="import-page" dir="rtl">
      <header className="import-topbar">
        <div>
          <p>منصة القائد / الاستيراد</p>
          <h1>قوالب Excel</h1>
        </div>
        <a href="/dashboard/import">العودة للاستيراد</a>
      </header>

      <section className="import-card">
        <section className="validation-section">
          <div className="section-title">
            <div>
              <h2>ابدأ من القالب المناسب لك</h2>
              <p>
                صممنا القوالب من منظور المستخدم: تعليمات واضحة، الحقول المطلوبة منفصلة عن الاختيارية، وورقة لشرح كل حقل قبل أن تبدأ التعبئة.
              </p>
            </div>
          </div>

          <div className="mapping-grid">
            {templates.map((t) => (
              <div className="value-map-block" key={t.key}>
                <div className="value-map-title">
                  <strong>{t.title}</strong>
                  <span>XLSX</span>
                </div>
                <p>{t.description}</p>
                <p><strong>مطلوب:</strong> {t.required.join("، ")}</p>
                <p><strong>اختياري:</strong> {t.optional.join("، ")}</p>
                <button className="primary-action" onClick={() => download(t.key)}>
                  تحميل Excel
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="mapping-note">
          <strong>كيف ستسير العملية؟</strong>
          <span>
            1) تختار القالب المناسب  2) تعبئ البيانات  3) ترفع Excel  4) المنصة تفحص الحقول  5) تطابق الحسابات والأبعاد  6) تعرض أي مشكلة للمستخدم  7) لا يتم النشر إلا بعد اجتياز التحقق.
          </span>
        </div>

        <div className="mapping-note">
          <strong>ملاحظة مهمة</strong>
          <span>
            القالب لا يفترض أن المستخدم خبير تقني. لذلك لا نطلب منه IDs داخل قاعدة البيانات؛ يستخدم كود أو اسم العنصر، والمنصة تتولى المطابقة وتطلب التدخل فقط عند وجود غموض.
          </span>
        </div>
      </section>
    </main>
  );
}
