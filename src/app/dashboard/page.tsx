"use client";

import { useEffect, useState } from "react";

const sections = [
  ["overview", "نظرة عامة"],
  ["performance", "الأداء المالي"],
  ["cash", "توقع السيولة"],
  ["variance", "تحليل الانحرافات"],
];

const kpis = ["الإيرادات", "مجمل الربح", "EBITDA", "صافي الربح", "النقدية"];

export default function DashboardPage() {
  const [workspaceName, setWorkspaceName] = useState("مساحة العمل");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("fpa_demo_workspace");
      if (raw) {
        const workspace = JSON.parse(raw) as { name?: string };
        if (workspace.name) setWorkspaceName(workspace.name);
      }
    } catch {
      // Keep the neutral workspace label when local demo storage is unavailable.
    }
  }, []);

  return (
    <div className="app-shell" dir="rtl">
      <aside className="sidebar">
        <div className="side-brand">
          <span className="side-mark">ق</span>
          <div>
            <strong>منصة القائد</strong>
            <small>التخطيط والتحليل المالي</small>
          </div>
        </div>

        <div className="workspace-switcher">
          <span className="workspace-label">مساحة العمل</span>
          <strong>{workspaceName}</strong>
          <span className="workspace-meta">لا توجد بيانات مالية منشورة بعد</span>
        </div>

        <nav className="sidebar-nav" aria-label="القائمة الرئيسية">
          <span className="nav-section-title">نظرة الإدارة</span>
          {sections.map(([id, label], index) => (
            <a key={id} className={`side-link ${index === 0 ? "active" : ""}`} href={`#${id}`}>
              <span className="side-icon">{["⌂", "◫", "◈", "▥"][index]}</span>
              <span>{label}</span>
            </a>
          ))}
          <span className="nav-section-title settings-title">دورة البيانات</span>
          <a className="side-link" href="/dashboard/setup"><span className="side-icon">⚙</span><span>الإعداد المالي</span></a>
          <a className="side-link" href="/dashboard/import"><span className="side-icon">⇧</span><span>الاستيراد والبيانات</span></a>
          <span className="side-link side-link-disabled"><span className="side-icon">✦</span><span>المحلل المالي AI</span><em>بعد النموذج المالي</em></span>
        </nav>
      </aside>

      <main className="dashboard-main">
        <header className="topbar">
          <div>
            <p className="breadcrumb">مساحة العمل / <strong>نظرة عامة</strong></p>
            <h1>نظرة عامة</h1>
          </div>
          <div className="topbar-actions">
            <span className="data-state-badge">بانتظار البيانات الفعلية</span>
            <span className="top-user" aria-hidden="true">خ</span>
          </div>
        </header>

        <div className="content" id="overview">
          <section className="data-state-banner" role="status">
            <div className="state-icon">!</div>
            <div>
              <strong>لا توجد مؤشرات مالية معروضة حاليًا</strong>
              <p>هذا مقصود وليس نقصًا في البيانات التجريبية. لا يتم عرض أي رقم أو نسبة أو رسم مالي قبل وجود بيانات فعلية تم استيرادها والتحقق منها ونشرها داخل النموذج المالي.</p>
            </div>
          </section>

          <section className="welcome-row">
            <div>
              <p className="eyebrow">لوحة الإدارة</p>
              <h2>لوحة مالية مبنية على بياناتك</h2>
              <p>ستظهر هنا نتائج الأداء الفعلي والميزانية والتوقع والسيولة والانحرافات بعد اكتمال سلسلة البيانات المالية الحاكمة.</p>
            </div>
          </section>

          <section className="metric-grid-app" aria-label="المؤشرات الرئيسية">
            {kpis.map((label) => (
              <article className="metric-card-app empty-card" key={label}>
                <div className="metric-label"><span>{label}</span><i>—</i></div>
                <strong>لا توجد بيانات</strong>
                <div className="metric-foot"><span>بانتظار البيانات المالية</span></div>
              </article>
            ))}
          </section>

          <section className="main-grid">
            <article className="panel empty-panel" id="performance">
              <div className="panel-header">
                <div><h3>الأداء المالي</h3><p>الإيرادات الفعلية مقارنة بالخطة والتوقع</p></div>
                <span className="section-state">غير متاح بعد</span>
              </div>
              <div className="empty-state-large">
                <strong>لا يمكن حساب الأداء بعد</strong>
                <p>يلزم نشر بيانات فعلية موثقة، ثم إنشاء ميزانية أو توقع للمقارنة.</p>
              </div>
            </article>

            <article className="panel empty-panel">
              <div className="panel-header">
                <div><h3>يحتاج إلى انتباه</h3><p>إشارات الإدارة الناتجة عن البيانات</p></div>
                <span className="section-state">—</span>
              </div>
              <div className="empty-state-compact">
                <span className="empty-dot">—</span>
                <div><strong>لا توجد تنبيهات مالية</strong><p>سيتم توليد التنبيهات من نتائج فعلية محسوبة، وليس من بيانات افتراضية.</p></div>
              </div>
            </article>
          </section>

          <section className="panel empty-panel" id="variance">
            <div className="panel-header">
              <div><h3>تحليل الانحرافات</h3><p>فعلي مقابل الميزانية أو التوقع</p></div>
              <span className="section-state">بانتظار المقارنة</span>
            </div>
            <div className="empty-table">
              <div className="empty-table-head"><span>البند</span><span>فعلي</span><span>المقارنة</span><span>الانحراف</span></div>
              <div className="empty-table-row"><strong>لا توجد بيانات منشورة</strong><span>—</span><span>—</span><span>—</span></div>
            </div>
          </section>

          <section className="bottom-grid">
            <article className="panel empty-panel" id="cash">
              <div className="panel-header">
                <div><h3>توقع السيولة</h3><p>الرصيد الافتتاحي والتحصيلات والمدفوعات والتمويل والنفقات الرأسمالية</p></div>
                <span className="section-state">غير متاح بعد</span>
              </div>
              <div className="cash-empty">
                <strong>لا يوجد توقع نقدي محسوب</strong>
                <p>سيُحسب وفق المعادلة المعتمدة: الرصيد الافتتاحي + التحصيلات المتوقعة − المدفوعات المتوقعة + التمويل − النفقات الرأسمالية.</p>
              </div>
            </article>

            <article className="panel empty-panel">
              <div className="panel-header">
                <div><h3>حالة التخطيط</h3><p>دورة الميزانية والتوقع والسيناريوهات</p></div>
              </div>
              <div className="planning-list">
                <div><span>البيانات الفعلية</span><b>غير منشورة</b></div>
                <div><span>الميزانية</span><b>لم تُنشأ</b></div>
                <div><span>التوقع</span><b>لم يُنشأ</b></div>
                <div><span>السيناريوهات</span><b>لم تُنشأ</b></div>
              </div>
            </article>
          </section>

          <footer className="app-footer">
            <span>منصة القائد للتخطيط والتحليل المالي</span>
            <span>لا يتم استخدام بيانات أو أرقام افتراضية لاتخاذ قرارات مالية</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
