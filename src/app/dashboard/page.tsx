const metrics = [
  { label: "الإيرادات الفعلية", value: "—", comparison: "لا توجد بيانات منشورة" },
  { label: "مجمل الربح", value: "—", comparison: "بانتظار البيانات الفعلية" },
  { label: "EBITDA", value: "—", comparison: "بانتظار البيانات الفعلية" },
  { label: "النقد المتوقع", value: "—", comparison: "سيظهر بعد بناء التوقع النقدي" },
];

const priorities = [
  "ربط النموذج المالي بمصدر بيانات موثوق",
  "التحقق من البيانات قبل نشرها إلى النموذج المالي",
  "بناء الموازنة والتوقعات على بيانات منشورة فقط",
];

export default function DashboardPage() {
  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">نظرة الإدارة</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            لوحة الأداء المالي
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500 sm:text-base">
            هذه اللوحة تعرض البيانات المحكومة فقط. لا توجد أرقام افتراضية داخل المنتج المالي؛
            ستظهر المؤشرات بعد استيراد البيانات والتحقق منها ونشرها.
          </p>
        </div>
        <a
          href="/dashboard/import"
          className="inline-flex w-fit items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          إضافة بيانات مالية
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
            <p className="mt-5 text-3xl font-bold tracking-tight text-slate-950">{metric.value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">{metric.comparison}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">دورة FP&A</p>
              <h3 className="mt-1 text-xl font-bold">من البيانات إلى القرار</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">المرحلة 2</span>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["01", "البيانات", "مصادر Excel أو CSV أو تكاملات"],
              ["02", "التحقق", "كشف الأخطاء والتناقضات"],
              ["03", "النموذج المالي", "حقائق مالية وفترات وأبعاد"],
              ["04", "التخطيط", "الموازنة والتوقع والسيناريو"],
            ].map(([number, title, description]) => (
              <div key={number} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-xs font-bold text-slate-400">{number}</span>
                <h4 className="mt-3 font-semibold text-slate-900">{title}</h4>
                <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-slate-500">الأولوية الحالية</p>
          <h3 className="mt-1 text-xl font-bold">أساس مالي موثوق</h3>
          <div className="mt-6 space-y-4">
            {priorities.map((priority, index) => (
              <div key={priority} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {index + 1}
                </span>
                <p className="text-sm leading-6 text-slate-600">{priority}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
