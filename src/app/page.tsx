const foundations = [
  {
    title: "Financial model first",
    text: "كل التحليلات المستقبلية ستُبنى على نموذج مالي منضبط وقابل للتدقيق.",
  },
  {
    title: "Decision support",
    text: "المنصة مصممة لمساعدة الإدارة على فهم الأداء واتخاذ القرار، وليست نظام محاسبة.",
  },
  {
    title: "Governed data",
    text: "البيانات المالية تمر عبر التحقق والتصنيف قبل أن تصبح أساسًا للتحليل والتخطيط.",
  },
];

export default function HomePage() {
  return (
    <main className="page">
      <div className="container">
        <header className="header">
          <div className="brand">FP&amp;A Platform</div>
          <div className="badge">Foundation v0.1</div>
        </header>

        <section className="hero">
          <p className="eyebrow">التخطيط والتحليل المالي</p>
          <h1 className="title">من البيانات المالية إلى قرارات أفضل</h1>
          <p className="subtitle">
            نبني طبقة FP&amp;A فوق أنظمة المحاسبة والـERP والملفات التشغيلية لتجميع البيانات
            والتحقق منها ثم تحويلها إلى ميزانيات وتوقعات وتحليلات قابلة للتفسير.
          </p>
        </section>

        <section className="grid" aria-label="مبادئ المنصة">
          {foundations.map((item) => (
            <article className="card" key={item.title}>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
