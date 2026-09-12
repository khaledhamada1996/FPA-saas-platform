"use client";

import Link from "next/link";

const reports = [
  { title: "لوحة الإدارة التنفيذية", text: "ملخص مؤشرات الأداء والربحية والنمو والتنبيهات المالية.", href: "/workspace/executive-dashboard" },
  { title: "القوائم المالية", text: "قائمة الدخل والميزانية من البيانات الفعلية المنشورة.", href: "/workspace/financial-statements" },
  { title: "التحليل المالي", text: "النمو والهوامش والربحية والاتجاهات المالية.", href: "/workspace/financial-analysis" },
  { title: "الفعلي مقابل الخطة", text: "الفروقات بين الفعلي والميزانية والتوقعات المعتمدة.", href: "/workspace/variance" },
  { title: "تحليل الأبعاد", text: "تحليل الفروع ومراكز التكلفة من البيانات الفعلية المنشورة.", href: "/workspace/dimensions" },
  { title: "المحلل المالي الذكي", text: "تفسير النتائج والتقارير اعتمادًا على السياق المالي الحتمي.", href: "/workspace/ai-analyst" },
];

export default function ReportsPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-xs font-bold tracking-[0.16em] text-slate-400">REPORTING</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">التقارير</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">مركز واحد للوصول إلى التقارير المالية الأساسية. لا ينشئ هذا القسم بيانات جديدة ولا يستبدل المحركات المالية الأصلية.</p>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <Link key={report.href} href={report.href} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-400 hover:shadow-md">
              <h2 className="font-bold text-slate-950">{report.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">{report.text}</p>
              <span className="mt-5 inline-block text-xs font-bold text-slate-400">فتح التقرير ←</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
