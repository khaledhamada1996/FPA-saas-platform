import Link from "next/link";

export default function LandingPage() {
  return (
    <main dir="rtl">
      <section className="hero">
        <div className="container">
          <p className="eyebrow">منصة القائد للتخطيط والتحليل المالي</p>
          <h1>حوّل بياناتك المالية إلى قرارات إدارية أوضح</h1>
          <p>منصة FP&A تجمع البيانات الفعلية والميزانيات والتوقعات والسيناريوهات في نموذج مالي موحد يساعد الإدارة على فهم الأداء واتخاذ القرار.</p>
          <div className="actions">
            <Link className="primary-button" href="/workspace">ابدأ الآن</Link>
            <Link className="secondary-button" href="/auth">تسجيل الدخول</Link>
          </div>
        </div>
      </section>
      <section className="container" style={{ padding: "56px 20px" }}>
        <div className="section-heading"><p className="eyebrow">كيف تعمل المنصة</p><h2>بياناتك أولًا ثم التحليل</h2><p>لا تعرض المنصة نتائج مالية افتراضية. تبدأ النتائج بعد إدخال بيانات منشأتك والتحقق منها ونشرها في النموذج المالي.</p></div>
        <div className="feature-grid">
          <article><span>01</span><h3>استيراد البيانات</h3><p>ارفع ملف Excel أو أدخل القيود يدويًا أو اربط مصدرًا محاسبيًا عند توفر التكامل.</p></article>
          <article><span>02</span><h3>التحقق والربط</h3><p>مطابقة الحسابات والأبعاد والتحقق من توازن القيود قبل اعتماد البيانات.</p></article>
          <article><span>03</span><h3>التخطيط والتحليل</h3><p>بعد اعتماد البيانات يمكن بناء الميزانية والتوقعات وتحليل الانحرافات والسيولة والسيناريوهات.</p></article>
        </div>
      </section>
      <section className="container" style={{ padding: "0 20px 70px" }}>
        <div className="data-principles">
          <div><strong>بيانات فعلية</strong><span>تُحسب من بيانات منشأتك فقط</span></div>
          <div><strong>ميزانية</strong><span>تُبنى من افتراضاتك وإصداراتك المعتمدة</span></div>
          <div><strong>توقع</strong><span>يعتمد على البيانات الفعلية والافتراضات المحددة</span></div>
          <div><strong>سيناريو</strong><span>نسخة مستقلة لاختبار القرارات والافتراضات</span></div>
        </div>
      </section>
    </main>
  );
}
