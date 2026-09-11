"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const sections = [["overview", "نظرة عامة"], ["performance", "الأداء المالي"], ["cash", "توقع السيولة"], ["variance", "تحليل الانحرافات"]];
const kpis = ["الإيرادات", "مجمل الربح", "EBITDA", "صافي الربح", "النقدية"];

type DataState = {
  loading: boolean;
  authenticated: boolean;
  hasActuals: boolean;
  batchCount: number;
  factCount: number;
  latestPublishedAt: string | null;
  error: string;
};

export default function DashboardPage() {
  const [workspaceName, setWorkspaceName] = useState("مساحة العمل");
  const [dataState, setDataState] = useState<DataState>({ loading: true, authenticated: false, hasActuals: false, batchCount: 0, factCount: 0, latestPublishedAt: null, error: "" });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("fpa_demo_workspace");
      if (raw) { const workspace = JSON.parse(raw) as { name?: string }; if (workspace.name) setWorkspaceName(workspace.name); }
    } catch { /* Keep neutral label. */ }

    async function loadDataState() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setDataState((current) => ({ ...current, loading: false, authenticated: false })); return; }

      const { data: membership, error: membershipError } = await supabase.from("organization_members").select("organization_id").limit(1).maybeSingle();
      if (membershipError || !membership?.organization_id) {
        setDataState({ loading: false, authenticated: true, hasActuals: false, batchCount: 0, factCount: 0, latestPublishedAt: null, error: "تعذر تحديد مساحة العمل الحالية" });
        return;
      }

      const organizationId = membership.organization_id;
      const [{ count: batchCount, error: batchError }, { count: factCount, error: factError }, { data: latestBatch, error: latestError }] = await Promise.all([
        supabase.from("actual_import_batches").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "published"),
        supabase.from("actual_financial_facts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
        supabase.from("actual_import_batches").select("published_at").eq("organization_id", organizationId).eq("status", "published").order("published_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      setDataState({ loading: false, authenticated: true, hasActuals: (factCount ?? 0) > 0, batchCount: batchCount ?? 0, factCount: factCount ?? 0, latestPublishedAt: latestBatch?.published_at ?? null, error: batchError?.message || factError?.message || latestError?.message || "" });
    }
    void loadDataState();
  }, []);

  const statusText = dataState.loading ? "جارٍ التحقق من البيانات" : dataState.hasActuals ? "بيانات فعلية منشورة" : dataState.authenticated ? "بانتظار البيانات الفعلية" : "يلزم تسجيل الدخول";

  return (
    <div className="app-shell" dir="rtl">
      <aside className="sidebar">
        <div className="side-brand"><span className="side-mark">ق</span><div><strong>منصة القائد</strong><small>التخطيط والتحليل المالي</small></div></div>
        <div className="workspace-switcher"><span className="workspace-label">مساحة العمل</span><strong>{workspaceName}</strong><span className="workspace-meta">{dataState.hasActuals ? `${dataState.factCount.toLocaleString("ar-SA")} حقيقة مالية منشورة` : "لا توجد بيانات مالية منشورة بعد"}</span></div>
        <nav className="sidebar-nav" aria-label="القائمة الرئيسية">
          <span className="nav-section-title">نظرة الإدارة</span>
          {sections.map(([id, label], index) => <a key={id} className={`side-link ${index === 0 ? "active" : ""}`} href={`#${id}`}><span className="side-icon">{["⌂", "◫", "◈", "▥"][index]}</span><span>{label}</span></a>)}
          <span className="nav-section-title settings-title">دورة البيانات</span>
          <a className="side-link" href="/dashboard/setup"><span className="side-icon">⚙</span><span>الإعداد المالي</span></a>
          <a className="side-link" href="/dashboard/import"><span className="side-icon">⇧</span><span>الاستيراد والبيانات</span></a>
          <span className="side-link side-link-disabled"><span className="side-icon">✦</span><span>المحلل المالي AI</span><em>بعد النموذج المالي</em></span>
        </nav>
      </aside>

      <main className="dashboard-main">
        <header className="topbar"><div><p className="breadcrumb">مساحة العمل / <strong>نظرة عامة</strong></p><h1>نظرة عامة</h1></div><div className="topbar-actions"><span className="data-state-badge">{statusText}</span><span className="top-user" aria-hidden="true">خ</span></div></header>

        <div className="content" id="overview">
          <section className="data-state-banner" role="status">
            <div className="state-icon">{dataState.hasActuals ? "✓" : "!"}</div>
            <div>
              <strong>{dataState.loading ? "جارٍ قراءة حالة البيانات" : dataState.hasActuals ? "البيانات الفعلية متاحة للنموذج المالي" : "لا توجد مؤشرات مالية معروضة حاليًا"}</strong>
              <p>{dataState.loading ? "يتم التحقق من مساحة العمل والدفعات المنشورة من قاعدة البيانات." : dataState.hasActuals ? `تم نشر ${dataState.batchCount.toLocaleString("ar-SA")} دفعة فعلية تحتوي على ${dataState.factCount.toLocaleString("ar-SA")} حقيقة مالية. المؤشرات ستُحسب فقط بعد اكتمال تعريف الحسابات وقواعد القوائم والتخطيط.` : dataState.authenticated ? "لا يتم عرض أي رقم أو نسبة أو رسم مالي قبل وجود بيانات فعلية تم استيرادها والتحقق منها ونشرها داخل النموذج المالي." : "هذه الواجهة مؤقتة أثناء تأجيل تسجيل الدخول. البيانات المالية لا تُعرض من المتصفح قبل وجود جلسة مستخدم ومساحة عمل مصرح بها."}</p>
              {dataState.error && <small>{dataState.error}</small>}
            </div>
          </section>

          <section className="welcome-row"><div><p className="eyebrow">لوحة الإدارة</p><h2>لوحة مالية مبنية على بياناتك</h2><p>تظهر نتائج الأداء الفعلي والميزانية والتوقع والسيولة والانحرافات بعد اكتمال سلسلة البيانات المالية الحاكمة.</p></div></section>

          <section className="metric-grid-app" aria-label="المؤشرات الرئيسية">
            {kpis.map((label) => <article className="metric-card-app empty-card" key={label}><div className="metric-label"><span>{label}</span><i>—</i></div><strong>لا توجد نتيجة محسوبة</strong><div className="metric-foot"><span>{dataState.hasActuals ? "بانتظار قواعد النموذج المالي" : "بانتظار البيانات المالية"}</span></div></article>)}
          </section>

          <section className="main-grid">
            <article className="panel empty-panel" id="performance"><div className="panel-header"><div><h3>الأداء المالي</h3><p>الإيرادات الفعلية مقارنة بالخطة والتوقع</p></div><span className="section-state">{dataState.hasActuals ? "النموذج قيد البناء" : "غير متاح بعد"}</span></div><div className="empty-state-large"><strong>{dataState.hasActuals ? "البيانات وصلت — لم نختلق نتيجة" : "لا يمكن حساب الأداء بعد"}</strong><p>{dataState.hasActuals ? "الخطوة التالية هي ربط تصنيفات الحسابات بقائمة الدخل ثم إضافة الميزانية والتوقع قبل حساب الأداء والانحرافات." : "يلزم نشر بيانات فعلية موثقة، ثم إنشاء ميزانية أو توقع للمقارنة."}</p></div></article>
            <article className="panel empty-panel"><div className="panel-header"><div><h3>يحتاج إلى انتباه</h3><p>إشارات الإدارة الناتجة عن البيانات</p></div><span className="section-state">—</span></div><div className="empty-state-compact"><span className="empty-dot">—</span><div><strong>لا توجد تنبيهات مالية مولدة</strong><p>لن يتم إنشاء تنبيه قبل وجود نتيجة مالية محسوبة وقاعدة مادية واضحة للانحراف.</p></div></div></article>
          </section>

          <section className="panel empty-panel" id="variance"><div className="panel-header"><div><h3>تحليل الانحرافات</h3><p>فعلي مقابل الميزانية أو التوقع</p></div><span className="section-state">بانتظار المقارنة</span></div><div className="empty-table"><div className="empty-table-head"><span>البند</span><span>فعلي</span><span>المقارنة</span><span>الانحراف</span></div><div className="empty-table-row"><strong>لا توجد نتيجة مقارنة</strong><span>—</span><span>—</span><span>—</span></div></div></section>

          <section className="bottom-grid">
            <article className="panel empty-panel" id="cash"><div className="panel-header"><div><h3>توقع السيولة</h3><p>الرصيد الافتتاحي والتحصيلات والمدفوعات والتمويل والنفقات الرأسمالية</p></div><span className="section-state">غير متاح بعد</span></div><div className="cash-empty"><strong>لا يوجد توقع نقدي محسوب</strong><p>سيُحسب وفق المعادلة المعتمدة: الرصيد الافتتاحي + التحصيلات المتوقعة − المدفوعات المتوقعة + التمويل − النفقات الرأسمالية.</p></div></article>
            <article className="panel empty-panel"><div className="panel-header"><div><h3>حالة التخطيط</h3><p>دورة الميزانية والتوقع والسيناريوهات</p></div></div><div className="planning-list"><div><span>البيانات الفعلية</span><b>{dataState.hasActuals ? "منشورة" : "غير منشورة"}</b></div><div><span>الميزانية</span><b>لم تُنشأ</b></div><div><span>التوقع</span><b>لم يُنشأ</b></div><div><span>السيناريوهات</span><b>لم تُنشأ</b></div></div></article>
          </section>

          <footer className="app-footer"><span>منصة القائد للتخطيط والتحليل المالي</span><span>لا يتم استخدام بيانات أو أرقام افتراضية لاتخاذ قرارات مالية</span></footer>
        </div>
      </main>
    </div>
  );
}
