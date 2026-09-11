"use client";

import * as XLSX from "xlsx";
import "../import.css";

const templates=[
 {key:"journal",title:"قالب القيود اليومية",description:"قالب Excel للقيود الفعلية مع الحسابات والأبعاد والتحقق قبل النشر."},
 {key:"accounts",title:"قالب شجرة الحسابات",description:"قالب Excel لكود الحساب والاسم والنوع والقائمة المالية والحساب الأب والرصيد الطبيعي."},
 {key:"budget",title:"قالب الموازنة",description:"قالب Excel للموازنة الشهرية والسنوية يمكن ربطه لاحقًا بمحرك Budget وForecast."},
];

function download(key:string){
 const wb=XLSX.utils.book_new();
 const instructions=[["تعليمات قالب القائد"],["لا تحذف أسماء الأعمدة المطلوبة"],["البيانات ستخضع للتحقق والمطابقة داخل المنصة قبل الاعتماد"],["لا تضع بيانات وهمية في الملف النهائي"]];
 const data=key==="journal"?["التاريخ","رقم القيد","وصف القيد","كود الحساب","اسم الحساب","مدين","دائن","الكيان القانوني","الفرع","الإدارة","مركز التكلفة","المنطقة","المنتج","المشروع"]:key==="accounts"?["كود الحساب","اسم الحساب","نوع الحساب","القائمة المالية","الحساب الأب","الرصيد الطبيعي"]:["السنة","الشهر","كود الحساب","اسم الحساب","الفرع","مركز التكلفة","الموازنة","ملاحظات"];
 const ws1=XLSX.utils.aoa_to_sheet(instructions); const ws2=XLSX.utils.aoa_to_sheet([data]); XLSX.utils.book_append_sheet(wb,ws1,"تعليمات"); XLSX.utils.book_append_sheet(wb,ws2,key==="journal"?"القيود اليومية":key==="accounts"?"شجرة الحسابات":"الموازنة");
 XLSX.writeFile(wb,`AlQaed-${key}-template.xlsx`);
}

export default function ImportTemplatesPage(){return <main className="import-page" dir="rtl"><header className="import-topbar"><div><p>منصة القائد / الاستيراد</p><h1>قوالب Excel</h1></div><a href="/dashboard/import">العودة للاستيراد</a></header><section className="import-card"><div className="validation-section"><div className="section-title"><div><h2>قوالب القائد الرسمية</h2><p>Excel هو القالب الأساسي. بعد التعبئة ارفع الملف إلى محرك الاستيراد ليتم التحقق والمطابقة قبل النشر.</p></div></div><div className="mapping-grid">{templates.map(t=><div className="value-map-block" key={t.key}><div className="value-map-title"><strong>{t.title}</strong><span>XLSX</span></div><p>{t.description}</p><button className="primary-action" onClick={()=>download(t.key)}>تحميل Excel</button></div>)}</div><div className="mapping-note"><strong>الدقة</strong><span>القالب يسهل الإدخال ولا يمنح البيانات ثقة تلقائية. المنصة تعيد فحص الحسابات والفترات والأبعاد قبل الاعتماد.</span></div></div></section></main>}
