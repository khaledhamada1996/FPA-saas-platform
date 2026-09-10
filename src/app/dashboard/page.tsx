const navigation = [
  ["overview", "نظرة عامة", "⌂"],
  ["actuals", "الأداء الفعلي", "◫"],
  ["budget", "الميزانية", "▤"],
  ["forecast", "التوقعات", "◌"],
  ["scenarios", "السيناريوهات", "◇"],
  ["cash", "السيولة", "◈"],
  ["kpis", "مؤشرات الأداء", "◉"],
  ["reports", "التقارير", "▥"],
  ["ai", "المحلل المالي AI", "✦"],
  ["imports", "البيانات والاستيراد", "⇧"],
];

const metrics = [
  ["الإيرادات", "4.82 م", "+8.4%", "مقابل التوقع"],
  ["مجمل الربح", "1.52 م", "+5.7%", "مقابل التوقع"],
  ["EBITDA", "1.14 م", "+2.1%", "على الخطة"],
  ["النقدية", "2.36 م", "12.4 شهر", "تغطية متوقعة"],
];

const varianceRows = [
  ["المبيعات", "4.82 م", "4.46 م", "+360 ك", "+8.1%", "أعلى من الخطة"],
  ["تكلفة المبيعات", "3.30 م", "3.02 م", "+280 ك", "+9.3%", "تحتاج مراجعة"],
  ["المصروفات التشغيلية", "1.08 م", "1.12 م", "-40 ك", "-3.6%", "أفضل من الخطة"],
  ["صافي الربح", "620 ك", "570 ك", "+50 ك", "+8.8%", "أفضل من الخطة"],
];

export default function DashboardPage() {
  return (
    <div className="app-shell" dir="rtl">
      <aside className="sidebar">
        <div className="side-brand">
          <span className="side-mark">ق</span>
          <div><strong>منصة القائد</strong><small>التخطيط والتحليل المالي</small></div>
        </div>

        <div className="workspace-switcher">
          <span className="workspace-label">الشركة الحالية</span>
          <strong>شركة النماء التجارية</strong>
          <span className="workspace-meta">السنة المالية 2026</span>
        </div>

        <nav className="sidebar-nav" aria-label="القائمة الرئيسية">
          <span className="nav-section-title">مساحة العمل</span>
          {navigation.map(([id, label, icon], index) => (
            <a key={id} className={`side-link ${index === 0 ? "active" : ""}`} href={`#${id}`}>
              <span className="side-icon">{icon}</span>
              <span>{label}</span>
              {id === "ai" && <em>جديد</em>}
            </a>
          ))}
          <span className="nav-section-title settings-title">الإدارة</span>
          <a className="side-link" href="#settings"><span className="side-icon">⚙</span><span>الإعدادات</span></a>
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span>تحتاج إلى مساعدة؟</span>
            <strong>راجع دليل المنصة</strong>
          </div>
          <div className="user-row">
            <span className="avatar">خ</span>
            <div><strong>خالد</strong><small>مدير مالي</small></div>
            <span className="dots">•••</span>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="topbar">
          <div>
            <p className="breadcrumb">مساحة العمل / <strong>نظرة عامة</strong></p>
            <h1>نظرة عامة</h1>
          </div>
          <div className="topbar-actions">
            <button className="period-button">يناير — أكتوبر 2026 <span>⌄</span></button>
            <button className="icon-button" aria-label="الإشعارات">♢<span className="notification-dot" /></button>
            <button className="top-user">خ</button>
          </div>
        </header>

        <div className="content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">ملخص الإدارة</p>
              <h2>كيف تسير الشركة؟</h2>
              <p>الأداء الحالي أعلى من التوقع في الإيرادات وصافي الربح، مع ارتفاع يحتاج إلى متابعة في تكلفة المبيعات.</p>
            </div>
            <a className="primary-button" href="#reports">عرض التقرير الإداري <span>←</span></a>
          </section>

          <section className="metric-grid-app" aria-label="المؤشرات الرئيسية">
            {metrics.map(([label, value, change, note]) => (
              <article className="metric-card-app" key={label}>
                <div className="metric-label"><span>{label}</span><i>↗</i></div>
                <strong>{value}</strong>
                <div className="metric-foot"><span className="positive">{change}</span><span>{note}</span></div>
              </article>
            ))}
          </section>

          <section className="main-grid">
            <article className="panel performance-panel">
              <div className="panel-header">
                <div><h3>الأداء المالي</h3><p>الإيرادات الفعلية مقابل الميزانية والتوقع</p></div>
                <div className="legend"><span><i className="legend-actual" /> فعلي</span><span><i className="legend-plan" /> خطة</span></div>
              </div>
              <div className="chart-area">
                <div className="y-axis"><span>5م</span><span>4م</span><span>3م</span><span>2م</span><span>1م</span><span>0</span></div>
                <div className="chart-columns">
                  {[58, 65, 55, 72, 68, 78, 74, 86, 81, 92].map((height, i) => (
                    <div className="chart-column" key={i}>
                      <div className="bars-pair"><i style={{height: `${height}%`}} /><b style={{height: `${Math.max(height - 10, 30)}%`}} /></div>
                      <span>{["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت"][i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="panel attention-panel">
              <div className="panel-header"><div><h3>يحتاج إلى انتباه</h3><p>أهم الإشارات المالية الحالية</p></div><span className="count-badge">3</span></div>
              <div className="attention-list">
                <div className="attention-item warning"><span className="attention-icon">!</span><div><strong>تكلفة المبيعات أعلى من التوقع</strong><p>انحراف 280 ألف ريال في الفترة الحالية</p></div></div>
                <div className="attention-item"><span className="attention-icon">↗</span><div><strong>الإيرادات أعلى من التوقع</strong><p>تحسن بنسبة 8.1% عن الخطة</p></div></div>
                <div className="attention-item"><span className="attention-icon">◷</span><div><strong>تحديث التوقع مطلوب</strong><p>آخر تحديث للتوقع منذ 18 يومًا</p></div></div>
              </div>
              <a className="panel-link" href="#alerts">عرض جميع التنبيهات ←</a>
            </article>
          </section>

          <section className="panel variance-panel" id="actuals">
            <div className="panel-header">
              <div><h3>تحليل الانحرافات</h3><p>الأداء الفعلي مقارنة بالميزانية المعتمدة</p></div>
              <a className="panel-link" href="#variance">فتح التحليل الكامل ←</a>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>البند</th><th>فعلي</th><th>الميزانية</th><th>الانحراف</th><th>النسبة</th><th>التقييم</th></tr></thead>
                <tbody>{varianceRows.map((row) => <tr key={row[0]}><td><strong>{row[0]}</strong></td><td>{row[1]}</td><td>{row[2]}</td><td className={row[4].startsWith("-") ? "positive-text" : "variance-text"}>{row[3]}</td><td>{row[4]}</td><td><span className={row[5] === "تحتاج مراجعة" ? "status-warning" : "status-good"}>{row[5]}</span></td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className="bottom-grid">
            <article className="panel cash-panel" id="cash">
              <div className="panel-header"><div><h3>توقع السيولة</h3><p>الأشهر الستة القادمة</p></div><span className="cash-status">مستقر</span></div>
              <div className="cash-summary"><strong>2.36 م</strong><span>الرصيد المتوقع بنهاية الفترة</span></div>
              <div className="cash-line"><span style={{width: "76%"}} /></div>
              <div className="cash-labels"><span>أكتوبر</span><span>نوفمبر</span><span>ديسمبر</span><span>يناير</span><span>فبراير</span><span>مارس</span></div>
            </article>
            <article className="panel ai-panel" id="ai">
              <div className="ai-mark">✦</div>
              <div><p className="eyebrow">المحلل المالي AI</p><h3>اسأل عن أداء شركتك</h3><p>اعرف لماذا تغيرت الإيرادات أو أين توجد أكبر الانحرافات، بإجابات مبنية على بيانات مساحة العمل.</p></div>
              <a className="secondary-button" href="#ask-ai">اسأل المحلل <span>←</span></a>
            </article>
          </section>

          <footer className="app-footer"><span>منصة القائد للتخطيط والتحليل المالي</span><span>بيانات العرض تجريبية حتى يتم استيراد بيانات الشركة</span></footer>
        </div>
      </main>
    </div>
  );
}
