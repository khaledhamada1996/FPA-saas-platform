"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "./setup.css";

type Organization = { id: string; name: string; base_currency: string; fiscal_year_start_month: number };
type Period = { id: string; period_start: string; period_end: string; status: string };
const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
function formatPeriod(start: string) { const [year, month] = start.split("-"); return `${monthNames[Number(month) - 1]} ${year}`; }

export default function FinancialSetupPage() {
  const supabase = createClient();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadOrganizations() {
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("organizations").select("id,name,base_currency,fiscal_year_start_month").order("created_at", { ascending: true });
    if (queryError) { setError("تعذر تحميل مساحات العمل. يجب تسجيل الدخول بحساب لديه صلاحية على مساحة العمل."); setLoading(false); return; }
    setOrganizations(data ?? []); if (!organizationId && data?.[0]?.id) setOrganizationId(data[0].id); setLoading(false);
  }
  async function loadPeriods(orgId: string, year: number) {
    if (!orgId) return;
    const { data, error: queryError } = await supabase.from("financial_periods").select("id,period_start,period_end,status").eq("organization_id", orgId).gte("period_start", `${year}-01-01`).lt("period_start", `${year + 2}-01-01`).order("period_start");
    if (!queryError) setPeriods(data ?? []);
  }
  useEffect(() => { void loadOrganizations(); }, []);
  useEffect(() => { void loadPeriods(organizationId, fiscalYear); }, [organizationId, fiscalYear]);
  async function createPeriods() {
    if (!organizationId) return; setCreating(true); setMessage(""); setError("");
    const { data, error: rpcError } = await supabase.rpc("create_monthly_financial_periods", { target_organization_id: organizationId, fiscal_year: fiscalYear });
    if (rpcError) { setError(rpcError.message || "تعذر إنشاء الفترات المالية"); setCreating(false); return; }
    setMessage(`تم إنشاء ${data ?? 0} فترة مالية جديدة للسنة المالية ${fiscalYear}`); await loadPeriods(organizationId, fiscalYear); setCreating(false);
  }
  const selected = organizations.find((org) => org.id === organizationId);
  return (
    <main className="setup-page" dir="rtl">
      <header className="setup-header"><a href="/dashboard" className="back-link">← العودة إلى لوحة التحكم</a><span className="eyebrow">الإعداد المالي</span><h1>تهيئة السنة المالية</h1><p>إنشاء الفترات المالية التي سيعتمد عليها الاستيراد والتحليل والتقارير.</p></header>
      <section className="setup-card">
        <div className="field-group"><label htmlFor="organization">مساحة العمل</label><select id="organization" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} disabled={loading}><option value="">اختر مساحة العمل</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></div>
        <div className="field-grid"><div className="field-group"><label htmlFor="year">سنة بداية السنة المالية</label><input id="year" type="number" min={2000} max={2100} value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value))} /></div><div className="field-group readonly"><span>العملة</span><strong>{selected?.base_currency?.trim() || "SAR"}</strong></div><div className="field-group readonly"><span>بداية السنة المالية</span><strong>{selected ? monthNames[selected.fiscal_year_start_month - 1] : "—"}</strong></div></div>
        <div className="setup-action"><div><strong>12 فترة شهرية</strong><span>يتم إنشاء الفترات من شهر بداية السنة المالية ولمدة 12 شهرًا</span></div><button type="button" onClick={createPeriods} disabled={!organizationId || creating || loading}>{creating ? "جاري الإنشاء..." : "إنشاء الفترات"}</button></div>
        {message && <div className="notice success">{message}</div>}{error && <div className="notice error">{error}</div>}
      </section>
      <section className="periods-card"><div className="section-heading"><div><span className="eyebrow">الحالة</span><h2>الفترات الحالية</h2></div><span className="count">{periods.length} فترة</span></div>{periods.length === 0 ? <div className="empty-state">لا توجد فترات مالية منشأة لهذه المساحة حتى الآن.</div> : <div className="period-grid">{periods.map((period) => <div className="period-item" key={period.id}><strong>{formatPeriod(period.period_start)}</strong><span>{period.period_start} → {period.period_end}</span><small>{period.status === "open" ? "مفتوحة" : period.status === "closed" ? "مغلقة" : "مقفلة"}</small></div>)}</div>}</section>
      <section className="periods-card"><div className="section-heading"><div><span className="eyebrow">الخطوة التالية</span><h2>دليل الحسابات</h2></div><a className="back-link" href="/dashboard/setup/accounts">إدارة الحسابات ←</a></div><p className="empty-state">يجب تعريف الحسابات التي ستُربط بها البيانات المستوردة قبل نشر Actuals.</p></section>
    </main>
  );
}
