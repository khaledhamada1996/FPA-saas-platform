const navigation = [
  { label: "نظرة عامة", href: "/dashboard" },
  { label: "البيانات الفعلية", href: "/dashboard/actuals" },
  { label: "الموازنة", href: "/dashboard/budget" },
  { label: "التوقعات", href: "/dashboard/forecast" },
  { label: "السيناريوهات", href: "/dashboard/scenarios" },
  { label: "التدفقات النقدية", href: "/dashboard/cash" },
  { label: "مؤشرات الأداء", href: "/dashboard/kpis" },
  { label: "التقارير", href: "/dashboard/reports" },
  { label: "المحلل المالي", href: "/dashboard/ai" },
  { label: "البيانات والاستيراد", href: "/dashboard/import" },
];

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <aside className="hidden w-64 shrink-0 border-l border-slate-200 bg-white lg:block">
          <div className="sticky top-0 flex h-screen flex-col p-5">
            <div className="border-b border-slate-100 pb-5">
              <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">FP&A</p>
              <h1 className="mt-2 text-xl font-bold">منصة التخطيط المالي</h1>
              <p className="mt-1 text-sm text-slate-500">مساحة الإدارة والتحليل</p>
            </div>

            <nav className="mt-5 flex-1 space-y-1" aria-label="التنقل الرئيسي">
              {navigation.map((item, index) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    index === 0
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="border-t border-slate-100 pt-4 text-xs leading-6 text-slate-400">
              <p>الحسابات والإعدادات تأتي لاحقًا ضمن مرحلة الحوكمة وتسجيل الدخول</p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8 lg:px-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-400">مساحة العمل</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">الشركة الحالية</p>
              </div>
              <div className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500">
                SAR · سنوي
              </div>
            </div>
          </header>

          <div className="p-5 sm:p-8 lg:p-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
