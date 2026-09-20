"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type WorkflowStep = {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: string;
};

const steps: WorkflowStep[] = [
  { key: "data", label: "البيانات المالية", description: "إدخال واستيراد البيانات", href: "/workspace/data", icon: "01" },
  { key: "review", label: "التحقق والاعتماد", description: "مراجعة البيانات ونشرها", href: "/workspace/data/import", icon: "02" },
  { key: "planning", label: "التخطيط المالي", description: "الميزانية والتنبؤ والسيناريوهات", href: "/workspace/planning", icon: "03" },
  { key: "analysis", label: "التحليل المالي", description: "الأداء والفروقات والسيولة", href: "/workspace/analysis", icon: "04" },
  { key: "reports", label: "القوائم والتقارير", description: "القوائم والتقارير المالية", href: "/workspace/financial-statements", icon: "05" },
  { key: "management", label: "لوحة الإدارة", description: "الصورة التنفيذية والقرار", href: "/workspace/executive-dashboard", icon: "06" },
];

function activeKey(pathname: string) {
  if (pathname.startsWith("/workspace/data/import") || pathname.startsWith("/workspace/data/manual")) return "review";
  if (pathname.startsWith("/workspace/data")) return "data";
  if (pathname.startsWith("/workspace/planning") || pathname.startsWith("/workspace/budget") || pathname.startsWith("/workspace/forecast") || pathname.startsWith("/workspace/scenarios")) return "planning";
  if (pathname.startsWith("/workspace/analysis") || pathname.startsWith("/workspace/financial-analysis") || pathname.startsWith("/workspace/variance") || pathname.startsWith("/workspace/cash")) return "analysis";
  if (pathname.startsWith("/workspace/financial-statements") || pathname.startsWith("/workspace/reports") || pathname.startsWith("/workspace/tax-zakat")) return "reports";
  if (pathname.startsWith("/workspace/executive-dashboard")) return "management";
  return "data";
}

export default function FinancialWorkflow() {
  const pathname = usePathname() || "/workspace";
  const current = activeKey(pathname);
  const currentIndex = Math.max(0, steps.findIndex((step) => step.key === current));
  const next = steps[currentIndex + 1];

  return (
    <section dir="rtl" className="border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">FINANCIAL WORKFLOW</p>
            <h2 className="mt-1 text-base font-extrabold text-slate-950">دورة العمل المالية</h2>
          </div>
          <span className="hidden text-[11px] font-semibold text-slate-400 sm:block">من البيانات إلى القرار</span>
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-5 sm:px-6">
        <div className="flex min-w-[860px] items-start">
          {steps.map((step, index) => {
            const isCurrent = step.key === current;
            const isPast = index < currentIndex;
            return (
              <div key={step.key} className="flex min-w-0 flex-1 items-start">
                <Link href={step.href} className="group flex min-w-0 flex-1 flex-col items-center text-center">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full border text-[10px] font-black transition ${
                    isCurrent
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : isPast
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-400 group-hover:border-slate-300 group-hover:text-slate-700"
                  }`}>
                    {isPast ? "✓" : step.icon}
                  </span>
                  <span className={`mt-2 text-[11px] font-extrabold ${
                    isCurrent ? "text-blue-700" : "text-slate-700"
                  }`}>{step.label}</span>
                  <span className="mt-1 max-w-[130px] text-[9px] leading-4 text-slate-400">{step.description}</span>
                </Link>
                {index < steps.length - 1 && (
                  <span className={`mt-5 h-px min-w-5 flex-1 ${
                    index < currentIndex ? "bg-emerald-200" : "bg-slate-200"
                  }`} aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {next && (
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[10px] font-bold text-slate-400">الخطوة التالية</p>
            <p className="mt-1 text-sm font-extrabold text-slate-900">{next.label}</p>
            <p className="mt-1 text-xs text-slate-500">{next.description}</p>
          </div>
          <Link href={next.href} className="inline-flex w-fit items-center border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:border-slate-400 hover:bg-white">
            الانتقال للخطوة التالية ←
          </Link>
        </div>
      )}
    </section>
  );
}
