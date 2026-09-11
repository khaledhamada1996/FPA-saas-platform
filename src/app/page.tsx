const capabilities = [
  { number: "01", title: "بيانات مالية منظمة", text: "اجمع بياناتك من Excel أو مصادر الأنظمة المختلفة في نموذج مالي موحد." },
  { number: "02", title: "ميزانيات وتوقعات", text: "حوّل الأرقام التاريخية إلى ميزانية وتوقعات قابلة للمقارنة والتحديث." },
  { number: "03", title: "تحليل وفروقات", text: "اعرف ماذا حدث ولماذا وما الذي يحتاج إلى قرار إداري." },
  { number: "04", title: "سيناريوهات وقرارات", text: "اختبر أثر التغييرات قبل اتخاذ القرار وشاهد انعكاسها على النتائج." },
];

const flow = ["جمع البيانات", "التحقق", "النموذج المالي", "الميزانية", "التوقع", "الفروقات", "السيناريو", "القرار"];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8fa] text-[#172033]">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <div>
            <div className="text-xl font-bold tracking-tight text-slate-950">FP&A</div>
            <div className="text-xs text-slate-500">التخطيط والتحليل المالي</div>
          </div>
          <a href="/start" className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            ابدأ الآن
          </a>
        </div>
      </header>

      <section className="relative">
        <div className="absolute inset-x-0 top-0 -z-0 h-[520px] bg-[radial-gradient(circle_at_70%_25%,rgba(148,163,184,0.20),transparent_38%),radial-gradient(circle_at_25%_20%,rgba(203,213,225,0.30),transparent_32%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10 lg:pb-28 lg:pt-28">
          <div>
            <p className="mb-6 text-sm font-bold tracking-[0.18em] text-slate-500">FINANCIAL PLANNING & ANALYSIS</p>
            <h1 className="max-w-4xl text-5xl font-bold leading-[1.12] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
              من الأرقام المالية
              <span className="block text-slate-500">إلى القرار الواضح</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-9 text-slate-600 sm:text-xl">
              منصة FP&A تساعد الإدارة على تنظيم البيانات المالية وبناء الميزانيات والتوقعات وتحليل الأداء واختبار السيناريوهات في مكان واحد.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a href="/start" className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-8 py-4 text-base font-bold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800">
                ابدأ الآن
              </a>
              <span className="text-sm text-slate-500">ابدأ بإعداد بيئة العمل ثم أضف بياناتك</span>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-300/30 sm:p-7">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div>
                  <p className="text-xs font-semibold text-slate-400">EXECUTIVE VIEW</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">لوحة الأداء المالي</h2>
                </div>
                <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">2026</div>
              </div>
              <div className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4">
                {["الإيرادات", "مجمل الربح", "EBITDA", "النقد"].map((item, index) => (
                  <div key={item} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">{item}</p>
                    <p className="mt-3 text-lg font-bold text-slate-900">{["8.4M", "3.1M", "1.8M", "2.6M"][index]}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">مقارنة بالفترة السابقة</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-100 p-5">
                <div className="flex items-end gap-2" aria-hidden="true">
                  {[42, 58, 51, 72, 65, 84, 76, 92, 81, 96, 88, 100].map((height, index) => (
                    <div key={index} className="flex-1 rounded-t-md bg-slate-200" style={{ height: `${height}px` }} />
                  ))}
                </div>
                <div className="mt-4 flex justify-between text-[10px] text-slate-400">
                  <span>يناير</span><span>يونيو</span><span>ديسمبر</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.14em] text-slate-400">WHAT YOU CAN DO</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">كل ما تحتاجه الإدارة المالية في دورة واحدة</h2>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-slate-200 bg-slate-200 md:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((item) => (
              <article key={item.number} className="bg-white p-7 lg:p-8">
                <span className="text-xs font-bold text-slate-400">{item.number}</span>
                <h3 className="mt-12 text-lg font-bold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#172033] text-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
          <p className="text-sm font-bold tracking-[0.14em] text-slate-400">THE FP&A CYCLE</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">مسار واضح من البيانات إلى القرار</h2>
          <div className="mt-12 grid gap-2 sm:grid-cols-2 lg:grid-cols-8">
            {flow.map((step, index) => (
              <div key={step} className="border border-slate-700 bg-slate-800/60 p-4">
                <span className="text-xs text-slate-500">{String(index + 1).padStart(2, "0")}</span>
                <p className="mt-8 text-sm font-semibold">{step}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-6 border-t border-slate-700 pt-8 sm:flex-row sm:items-center">
            <p className="max-w-xl leading-7 text-slate-400">ابدأ بإنشاء بيئة العمل، ثم سنبني معك الأداة خطوة بخطوة بداية من البيانات الفعلية.</p>
            <a href="/start" className="rounded-xl bg-white px-7 py-4 text-sm font-bold text-slate-950 transition hover:bg-slate-100">ابدأ الآن</a>
          </div>
        </div>
      </section>

      <footer className="bg-white px-6 py-7 text-center text-xs text-slate-400">FP&A Platform · Financial Planning & Analysis</footer>
    </main>
  );
}
