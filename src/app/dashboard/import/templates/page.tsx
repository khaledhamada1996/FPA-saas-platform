import "../import.css";

const templates = [
  {
    title: "قالب القيود اليومية",
    description: "لإدخال القيود الفعلية مع الحسابات والأبعاد قبل رفعها للمراجعة والمطابقة.",
    href: "/templates/journal-entries-template.csv",
  },
  {
    title: "قالب شجرة الحسابات",
    description: "لإعداد كود الحساب واسم الحساب ونوعه والقائمة المالية والحساب الأب والرصيد الطبيعي.",
    href: "/templates/chart-of-accounts-template.csv",
  },
];

export default function ImportTemplatesPage() {
  return (
    <main className="import-page" dir="rtl">
      <header className="import-topbar">
        <div>
          <p>منصة القائد / الاستيراد</p>
          <h1>قوالب البيانات</h1>
        </div>
        <a href="/dashboard/import">العودة للاستيراد</a>
      </header>

      <section className="import-card">
        <div className="validation-section">
          <div className="section-title">
            <div>
              <h2>قوالب القائد</h2>
              <p>نزّل القالب، أدخل بياناتك، ثم ارفعه إلى محرك الاستيراد. القالب لا يتجاوز قواعد التحقق والمطابقة.</p>
            </div>
          </div>

          <div className="mapping-grid">
            {templates.map((template) => (
              <div className="value-map-block" key={template.href}>
                <div className="value-map-title">
                  <strong>{template.title}</strong>
                </div>
                <p>{template.description}</p>
                <a className="primary-action" href={template.href} download>
                  تحميل القالب
                </a>
              </div>
            ))}
          </div>

          <div className="mapping-note">
            <strong>قاعدة الدقة</strong>
            <span>لا تعتمد المنصة أي رقم لمجرد أنه جاء من القالب. البيانات تمر بالتحقق، ثم مطابقة القيم، ثم فحوص قاعدة البيانات قبل النشر.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
