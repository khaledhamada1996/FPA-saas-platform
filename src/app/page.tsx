const modules = [
  { name: "النموذج المالي", description: "مصدر واحد منظم للبيانات المالية والحسابات والفترات والأبعاد." },
  { name: "التخطيط", description: "أساس الميزانيات والتوقعات والسيناريوهات القابلة للمقارنة." },
  { name: "التحليل", description: "تحويل الأداء المالي إلى فروقات ومؤشرات وأسئلة إدارية واضحة." },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold tracking-wide text-slate-500">FP&A PLATFORM · FOUNDATION</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
            منصة للتخطيط والتحليل المالي وصناعة القرار
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            طبقة مالية فوق الأنظمة المحاسبية والتشغيلية تجمع البيانات المنظمة مع الميزانيات والتوقعات والتحليل والسيناريوهات.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {modules.map((module) => (
            <article key={module.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">{module.name}</h2>
              <p className="mt-3 leading-7 text-slate-600">{module.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-500">دورة FP&A</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            جمع البيانات ← التحقق ← النموذج المالي ← الميزانية ← التوقع ← المقارنة ← السيناريو ← القرار
          </p>
        </div>
      </section>
    </main>
  );
}
