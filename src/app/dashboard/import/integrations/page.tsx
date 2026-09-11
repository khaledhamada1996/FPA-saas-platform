import "../import.css";

const integrations=[
 {name:"Odoo",type:"ERP / Accounting",status:"قريبًا",description:"ربط القيود والحسابات والأبعاد مع النموذج المالي الموحد."},
 {name:"Qoyod",type:"Accounting",status:"قريبًا",description:"مزامنة البيانات المالية بدل رفع الملفات يدويًا."},
 {name:"Zoho Books",type:"Accounting",status:"قريبًا",description:"استقبال البيانات المالية وتشغيل نفس محرك التحقق والمطابقة."},
 {name:"Foodics",type:"Operations",status:"قريبًا",description:"إدخال بيانات التشغيل للمطاعم وربطها بمحركات FP&A."},
];
export default function IntegrationsPage(){return <main className="import-page" dir="rtl"><header className="import-topbar"><div><p>منصة القائد / البيانات الفعلية</p><h1>التكاملات</h1></div><a href="/dashboard/import">العودة للاستيراد</a></header><section className="import-card"><div className="validation-section"><div className="section-title"><div><h2>ربط الأنظمة</h2><p>الشركات الكبيرة يمكنها ربط أنظمتها بدل الاعتماد على الملفات. كل تكامل سيصب في النموذج المالي الموحد نفسه.</p></div></div><div className="mapping-grid">{integrations.map(x=><div className="value-map-block" key={x.name}><div className="value-map-title"><strong>{x.name}</strong><span>{x.status}</span></div><p>{x.type}</p><p>{x.description}</p><button className="primary-action" disabled>{x.status}</button></div>)}</div><div className="mapping-note"><strong>المبدأ</strong><span>التكامل لا يتجاوز Validation وMapping وReconciliation وDatabase Publish. لا توجد مزامنة صامتة أو أرقام افتراضية.</span></div></div></section></main>}
