"use client";

import { useMemo } from "react";
import { formatMoneyMinor, formatPercent } from "@/lib/format";

type BridgeValue = { current: number; comparison: number; delta: number };
type Bridge = Record<string, BridgeValue>;
const money=(v:number)=>formatMoneyMinor(Number(v||0));
const pct=(v:number)=>formatPercent(Number(v||0));
const value=(b:Bridge|undefined,k:string)=>Number(b?.[k]?.current||0);
const delta=(b:Bridge|undefined,k:string)=>Number(b?.[k]?.delta||0);
const margin=(b:Bridge|undefined,k:string)=>{const r=value(b,"revenue");return r?(value(b,k)/r)*100:null};
const growth=(b:Bridge|undefined,k:string)=>{const p=Number(b?.[k]?.comparison||0);return p?(delta(b,k)/Math.abs(p))*100:null};

export function ExecutiveProfitIntelligence({bridge,comparison}:{bridge?:Bridge|null;drivers?:unknown[];comparison:boolean}){
 const b=bridge||undefined;
 const insights=useMemo(()=>{
  if(!b)return [];
  const out:Array<{title:string;text:string;tone:"positive"|"negative"|"neutral"}>=[];
  const rev=value(b,"revenue"),revD=delta(b,"revenue"),gross=value(b,"gross_profit"),grossD=delta(b,"gross_profit"),ebitda=value(b,"ebitda"),ebitdaD=delta(b,"ebitda"),net=value(b,"net_income"),netD=delta(b,"net_income");
  const gm=margin(b,"gross_profit"),em=margin(b,"ebitda"),rg=growth(b,"revenue"),cg=growth(b,"cogs"),og=growth(b,"operating_expenses");
  const prevR=Number(b.revenue?.comparison||0),prevG=Number(b.gross_profit?.comparison||0),prevGM=prevR?(prevG/prevR)*100:null;
  if(!comparison){
   if(rev)out.push({title:"مستوى الأداء",text:`الإيرادات ${money(rev)} ومجمل الربح ${money(gross)} بهامش ${gm==null?"—":pct(gm)} وEBITDA ${money(ebitda)} بهامش ${em==null?"—":pct(em)}.`,tone:ebitda>=0?"positive":"negative"});
   if(net<0)out.push({title:"نقطة انتباه",text:`صافي الربح سلبي بقيمة ${money(net)}. البيانات الحالية تشير إلى حاجة لتحليل مصدر الضغط المالي.`,tone:"negative"});
   return out;
  }
  if(revD!==0)out.push({title:revD>0?"نمو الإيرادات":"تراجع الإيرادات",text:`الإيرادات ${revD>0?"زادت":"انخفضت"} ${money(Math.abs(revD))}${rg==null?"":` (${pct(Math.abs(rg))})`} مقارنة بالفترة السابقة.`,tone:revD>0?"positive":"negative"});
  if(gm!=null&&prevGM!=null){const mc=gm-prevGM;if(Math.abs(mc)>=1)out.push({title:mc<0?"ضغط على هامش الربح":"تحسن هامش الربح",text:`الهامش الإجمالي ${mc>0?"ارتفع":"انخفض"} ${pct(Math.abs(mc))} نقطة مئوية.`,tone:mc>0?"positive":"negative"});}
  if(rg!=null&&cg!=null&&cg>rg+5)out.push({title:"تكلفة المبيعات تضغط على النمو",text:`تكلفة المبيعات تنمو ${pct(Math.abs(cg))} مقابل ${pct(Math.abs(rg))} للإيرادات، ما يضغط على الهامش.`,tone:"negative"});
  if(rg!=null&&og!=null&&og>rg+5)out.push({title:"ضغط تشغيلي",text:`المصروفات التشغيلية تنمو ${pct(Math.abs(og))} مقابل ${pct(Math.abs(rg))} للإيرادات.`,tone:"negative"});
  if(ebitdaD!==0&&netD!==0&&Math.sign(ebitdaD)!==Math.sign(netD))out.push({title:"فجوة بين التشغيل والنتيجة النهائية",text:`تغير EBITDA ${money(ebitdaD)} بينما تغير صافي الربح ${money(netD)}، ما يعني أن بنود ما بعد EBITDA تؤثر في النتيجة.`,tone:"negative"});
  if(revD>0&&grossD>0&&grossD<revD*.5)out.push({title:"النمو لا يتحول بالكامل إلى ربح",text:"نمو الإيرادات لا ينعكس بنفس القوة على مجمل الربح، ما يستحق فحص جودة النمو والهامش.",tone:"negative"});
  if(net<0)out.push({title:"النتيجة النهائية تحت الصفر",text:`صافي الربح الحالي ${money(net)} ويحتاج إلى تفسير قبل اتخاذ إجراء.`,tone:"negative"});
  return out.slice(0,5);
 },[b,comparison]);
 if(!b)return null;
 const rev=value(b,"revenue"),gross=value(b,"gross_profit"),ebitda=value(b,"ebitda"),net=value(b,"net_income"),gm=margin(b,"gross_profit"),em=margin(b,"ebitda");
 return <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
  <article className="border border-slate-200 bg-white">
   <div className="border-b border-slate-200 px-4 py-3"><p className="text-[11px] font-black tracking-[0.12em] text-slate-400">EXECUTIVE INTELLIGENCE</p><div className="mt-1 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-sm font-black text-[#102d59]">ماذا تغير في الأداء المالي؟</h2><p className="mt-1 text-[11px] text-slate-400">إشارات مشتقة من بيانات مالية منشورة فقط، دون عرض الحسابات.</p></div><span className="text-[10px] font-bold text-slate-400">{comparison?"مقارنة بالفترة السابقة":"الفترة الحالية"}</span></div></div>
   <div className="grid border-b border-slate-100 sm:grid-cols-4">{[["الإيرادات",rev,null],["مجمل الربح",gross,gm],["EBITDA",ebitda,em],["صافي الربح",net,null]].map(([l,v,m])=><div key={String(l)} className="border-b border-slate-100 px-4 py-4 sm:border-b-0 sm:border-l last:sm:border-l-0"><p className="text-[10px] font-black text-slate-500">{l}</p><p className="mt-2 truncate text-base font-black text-[#102d59]">{money(Number(v))}</p>{m!=null&&<p className="mt-1 text-[10px] font-bold text-slate-400">الهامش {pct(Number(m))}</p>}</div>)}</div>
   <div className="divide-y divide-slate-100">{insights.length?insights.map((x,i)=><div key={`${x.title}-${i}`} className="flex gap-3 px-4 py-4"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${x.tone==="negative"?"bg-rose-500":x.tone==="positive"?"bg-emerald-500":"bg-slate-300"}`}/><div><p className="text-xs font-black text-slate-800">{x.title}</p><p className="mt-1 text-xs leading-6 text-slate-500">{x.text}</p></div></div>):<p className="p-5 text-xs text-slate-400">لا توجد حركة مالية كافية لاستخراج إشارة إدارية.</p>}</div>
  </article>
  <article className="border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><p className="text-[11px] font-black tracking-[0.12em] text-slate-400">MANAGEMENT FOCUS</p><h2 className="mt-1 text-sm font-black text-[#102d59]">ما الذي يستحق الانتباه؟</h2><p className="mt-1 text-[11px] text-slate-400">مؤشرات مبنية على النتائج الفعلية المتاحة.</p></div><div className="space-y-3 p-4"><div className="border border-slate-100 p-3"><p className="text-[10px] font-black text-slate-500">جودة النمو</p><p className="mt-1 text-xs font-bold text-slate-700">{comparison?(delta(b,"revenue")>0&&delta(b,"gross_profit")<=0?"الإيرادات تنمو دون تحسن موازٍ في مجمل الربح":"تُقرأ حركة الإيرادات مع تغير الهامش وليس منفردة"):"تحتاج المقارنة الزمنية لقياس جودة النمو"}</p></div><div className="border border-slate-100 p-3"><p className="text-[10px] font-black text-slate-500">الربحية التشغيلية</p><p className="mt-1 text-xs font-bold text-slate-700">هامش EBITDA: {em==null?"—":pct(em)}</p></div><div className="border border-slate-100 p-3"><p className="text-[10px] font-black text-slate-500">النتيجة النهائية</p><p className={`mt-1 text-xs font-bold ${net<0?"text-rose-600":"text-slate-700"}`}>{net<0?`صافي خسارة ${money(Math.abs(net))}`:`صافي ربح ${money(net)}`}</p></div></div></article>
 </section>;
}
