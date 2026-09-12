const capabilities = [
  { number: "01", title: "بيانات مالية منظمة", text: "اجمع بياناتك من Excel أو مصادر الأنظمة المختلفة في نموذج مالي موحد." },
  { number: "02", title: "ميزانيات وتوقعات", text: "حوّل الأرقام التاريخية إلى ميزانية وتوقعات قابلة للمقارنة والتحديث." },
  { number: "03", title: "تحليل وفروقات", text: "اعرف ماذا حدث ولماذا وما الذي يحتاج إلى قرار إداري." },
  { number: "04", title: "سيناريوهات وقرارات", text: "اختبر أثر التغييرات قبل اتخاذ القرار وشاهد انعكاسها على النتائج." },
];

const flow = ["جمع البيانات", "التحقق", "النموذج المالي", "الميزانية", "التوقع", "الفروقات", "السيناريو", "القرار"];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8fa] text-[#172033]" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <div className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">FP&A</div>
            <div className="text-xs text-slate-500">التخطيط والتحليل المالي</div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 sm:px-4">تسجيل الدخول</a>
            <a href="/signup" className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 sm:px-5">إنشاء حساب</a>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="absolute inset-x-0 top-0 -z-0 h-[460px] bg-[radial-gradient(circle_at_70%_25%,rgba(148,163,184,0.18),transparent_38%),radial-gradient(circle_at_25%_20%,rgba(203,213,225,0.25),transparent_32%)]" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:px-8 lg:pb-24 lg:pt-24">
          <div>
            <p className="mb-5 text-xs font-bold tracking-[0.16em] text-slate-500 sm:text-sm">FINANCIAL PLANNING & ANALYSIS</p>
            <h1 className="max-w-4xl text-4xl font-bold leading-[1.18] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl xl:text-7xl">
              من الأرقام المالية
              <span className="block text-slate-500">إلى القرار الواضح</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:mt-7 sm:text-lg sm:leading-9 lg:text-xl">
              منصة FP&A تساعد الإدارة على تنظيم البيانات المالية وبناء الميزانيات والتوقعات وتحليل الأداء واختبار السيناريوهات في مكان واحد.
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
              <a href="/signup" className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 sm:px-8 sm:py-4 sm:text-base">ابدأ الآن</a>
              <span className="text-center text-sm text-slate-500 sm:text-right">إنشاء حساب ثم إعداد مساحة العمل</span>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-300/20 sm:rounded-[24px] sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 sm:pb-5">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400">EXECUTIVE VIEW</p>
                  <h2 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">لوحة الأداء المالي</h2>
                </div>
                <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">2026</div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 py-5 sm:grid-cols-4 sm:gap-3 sm:py-6">
                {["الإيرادات", "مجمل الربح", "EBITDA", "النقد"].map((item, index) => (
                  <div key={item} className="rounded-xl bg-slate-50 p-3 sm:rounded-2xl sm:p-4">
                    <p className="text-[11px] text-slate-500 sm:text-xs">{item}</p>
                    <p className="mt-2 text-base font-bold text-slate-900 sm:mt-3 sm:text-lg">{["8.4M", "3.1M", "1.8M", "2.6M"][index]}</p>
                    <p className="mt-1 text-[10px] font-semibold text-slate-500 sm:text-xs">مقارنة بالفترة السابقة</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-100 p-4 sm:rounded-2xl sm:p-5">
                <div className="flex h-28 items-end gap-1.5 sm:h-32 sm:gap-2" aria-hidden="true">
                  {[42, 58, 51, 72, 65, 84, 76, 92, 81, 96, 88, 100].map((height, index) => (
                    <div key={index} className="flex-1 rounded-t-md bg-slate-200" style={{ height: `${height}%` }} />
                  ))}
                </div>
                <div className="mt-3 flex justify-between text-[9px] text-slate-400 sm:mt-4 sm:text-[10px]">
                  <span>يناير</span><span>يونيو</span><span>ديسمبر</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.14em] text-slate-400 sm:text-sm">WHAT YOU CAN DO</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">كل ما تحتاجه الإدارة المالية في دورة واحدة</h2>
          </div>
          <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:mt-10 md:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((item) => (
              <article key={item.number} className="bg-white p-5 sm:p-7 lg:p-8">
                <span className="text-xs font-bold text-slate-400">{item.number}</span>
                <h3 className="mt-8 text-base font-bold text-slate-950 sm:mt-12 sm:text-lg">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#172033] text-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <p className="text-xs font-bold tracking-[0.14em] text-slate-400 sm:text-sm">THE FP&A CYCLE</p>
          <h2 className="mt-3 max-w-3xl text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">مسار واضح من البيانات إلى القرار</h2>
          <div className="mt-8 grid gap-2 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {flow.map((step, index) => (
              <div key={step} className="border border-slate-700 bg-slate-800/60 p-4">
                <span className="text-xs text-slate-500">{String(index + 1).padStart(2, "0")}</span>
                <p className="mt-5 text-sm font-semibold sm:mt-8">{step}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-stretch justify-between gap-5 border-t border-slate-700 pt-7 sm:flex-row sm:items-center sm:gap-6 sm:pt-8">
            <p className="max-w-xl text-sm leading-7 text-slate-400 sm:text-base">ابدأ بإنشاء حساب ثم أنشئ بيئة العمل، وبعدها ستظهر لك وحدات FP&A من داخل مساحة العمل.</p>
            <a href="/signup" className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-slate-100 sm:px-7 sm:py-4">إنشاء حساب</a>
          </div>
        </div>
      </section>

      <footer className="bg-white px-4 py-6 text-center text-xs text-slate-400">FP&A Platform · Financial Planning & Analysis</footer>
    </main>
  );
}
