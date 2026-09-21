"use client";

import Link from "next/link";

const sources = [
  {title:"القيود اليومية",tag:"متاح الآن",description:"إذا كانت لديك حركة الحسابات بالتفصيل مدين ودائن، فهذا هو المسار المناسب.",href:"/workspace/data/import",action:"رفع القيود",active:true,icon:"↳"},
  {title:"ميزان المراجعة",tag:"مسار مستقل",description:"إذا كان لديك رصيد افتتاحي وحركة وإغلاق لكل حساب حسب الفترة، سنعتمد مسار TB مخصصًا.",href:"/workspace/trial-balance",action:"فتح ميزان المراجعة",active:true,icon:"∑"},
  {title:"القوائم المالية",tag:"مسار مستقل",description:"إذا كانت بياناتك تبدأ من القوائم، فالمسار مخصص للتحليل والتنبؤ دون إجبارك على إدخال القيود.",href:"/workspace/financial-statements",action:"فتح القوائم",active:true,icon:"▤"},
  {title:"نظام محاسبي",tag:"تكاملات",description:"اربط مصدرًا خارجيًا عندما تكون بياناتك موجودة في نظام محاسبي أو منصة تشغيلية مدعومة.",href:"/workspace/integrations",action:"عرض التكاملات",active:true,icon:"⇄"},
];

export default function AddFinancialDataPage(){
  return <main dir="rtl" className="min-h-[calc(100vh-84px)] bg-[#f7f8fa] text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6 lg:px-8">
        <Link href="/workspace/data" className="text-xs font-bold text-slate-500 hover:text-slate-950">← البيانات المالية</Link>
        <p className="mt-5 text-[11px] font-bold tracking-[0.16em] text-slate-400">ADD FINANCIAL DATA</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">كيف تريد أن تبدأ؟</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">اختر مصدر البيانات المتوفر لديك. لا تحتاج المنصة إلى أن تبدأ دائمًا من القيود اليومية.</p>
      </div>
    </header>
    <section className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="grid gap-4 md:grid-cols-2">
        {sources.map((item,index)=><article key={item.title} className="border border-slate-200 bg-white p-5 transition hover:border-slate-400 sm:p-6">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-slate-200 bg-slate-50 text-lg font-bold text-slate-700">{item.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold text-slate-400">0{index+1}</p><h2 className="mt-1 text-base font-extrabold text-slate-950">{item.title}</h2></div><span className="text-[10px] font-bold text-slate-500">{item.tag}</span></div>
              <p className="mt-3 text-sm leading-6 text-slate-500">{item.description}</p>
              <div className="mt-5"><Link href={item.href} className="inline-flex bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800">{item.action} ←</Link></div>
            </div>
          </div>
        </article>)}
      </div>
      <div className="mt-6 border border-slate-200 bg-slate-950 p-5 text-white">
        <p className="text-[10px] font-bold tracking-[0.16em] text-slate-500">WHAT HAPPENS NEXT</p>
        <p className="mt-2 text-sm leading-7 text-slate-300">بعد استلام المصدر، تختلف خطوات التجهيز حسب نوع البيانات. القيود تمر بالمطابقة والتسوية قبل النشر، بينما القوائم وميزان المراجعة لهما عقود بيانات وتحقيقات مستقلة.</p>
      </div>
    </section>
  </main>;
}
