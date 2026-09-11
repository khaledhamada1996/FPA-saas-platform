"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = { id: string; name: string; statement_type: string; parent_id: string | null };
type Account = {
  id: string;
  code: string;
  name: string;
  normal_balance: string;
  account_type: string | null;
  statement_type: string | null;
  statement_section: string | null;
  is_contra: boolean;
  parent_account_id: string | null;
  category_id: string | null;
};

const accountTypes = [
  ["asset", "أصل"],
  ["liability", "التزام"],
  ["equity", "حقوق ملكية"],
  ["revenue", "إيراد"],
  ["expense", "مصروف"],
] as const;

const statementTypes = [
  ["balance_sheet", "قائمة المركز المالي"],
  ["income_statement", "قائمة الدخل"],
  ["cash_flow", "قائمة التدفقات النقدية"],
] as const;

const sectionOptions: Record<string, string[]> = {
  balance_sheet: ["الأصول المتداولة", "الأصول غير المتداولة", "الالتزامات المتداولة", "الالتزامات غير المتداولة", "حقوق الملكية"],
  income_statement: ["الإيرادات", "تكلفة الإيرادات", "مصروفات التشغيل", "مصروفات أخرى", "إيرادات أخرى"],
  cash_flow: ["التدفقات من الأنشطة التشغيلية", "التدفقات من الأنشطة الاستثمارية", "التدفقات من الأنشطة التمويلية"],
};

function derivedBalance(type: string, contra: boolean) {
  const debit = type === "asset" || type === "expense";
  return contra ? (debit ? "credit" : "debit") : debit ? "debit" : "credit";
}

export default function AccountsSetupPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("");
  const [statementType, setStatementType] = useState("");
  const [statementSection, setStatementSection] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [parentAccountId, setParentAccountId] = useState("");
  const [contra, setContra] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryLoading, setCategoryLoading] = useState(false);

  const normalBalance = useMemo(() => derivedBalance(accountType, contra), [accountType, contra]);
  const sections = sectionOptions[statementType] ?? [];

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const stored = typeof window !== "undefined" ? window.localStorage.getItem("fpa_workspace_id") : null;
      let id = stored;
      if (!id) {
        const { data } = await supabase.from("organization_members").select("organization_id").limit(1).maybeSingle();
        id = data?.organization_id ?? null;
      }
      setOrgId(id);
      if (!id) return;
      const [{ data: categoryRows }, { data: accountRows }] = await Promise.all([
        supabase.from("account_categories").select("id,name,statement_type,parent_id").eq("organization_id", id).order("name"),
        supabase.from("accounts").select("id,code,name,normal_balance,account_type,statement_type,statement_section,is_contra,parent_account_id,category_id").eq("organization_id", id).order("code"),
      ]);
      setCategories(categoryRows ?? []);
      setAccounts(accountRows ?? []);
    };
    void load();
  }, []);

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    if (!orgId || !categoryName.trim() || !statementType) return;
    setCategoryLoading(true);
    setMessage("");
    const supabase = createClient();
    const { data, error } = await supabase.from("account_categories").insert({ organization_id: orgId, name: categoryName.trim(), statement_type: statementType }).select("id,name,statement_type,parent_id").single();
    setCategoryLoading(false);
    if (error) {
      setMessage(error.code === "23505" ? "اسم التصنيف موجود بالفعل" : "تعذر إنشاء التصنيف وقد تحتاج صلاحية مدير مساحة العمل");
      return;
    }
    if (data) setCategories((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name, "ar")));
    setCategoryName("");
    setMessage("تم إنشاء التصنيف");
  }

  async function addAccount(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!orgId || !code.trim() || !name.trim() || !accountType || !statementType || !statementSection) {
      setMessage("أكمل كود الحساب والاسم والتصنيف والقائمة والقسم");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("accounts").insert({
      organization_id: orgId,
      code: code.trim(),
      name: name.trim(),
      category_id: categoryId || null,
      parent_account_id: parentAccountId || null,
      account_type: accountType,
      statement_type: statementType,
      statement_section: statementSection,
      is_contra: contra,
      normal_balance: normalBalance,
    }).select("id,code,name,normal_balance,account_type,statement_type,statement_section,is_contra,parent_account_id,category_id").single();
    setLoading(false);
    if (error) {
      setMessage(error.code === "23505" ? "كود الحساب موجود بالفعل في مساحة العمل" : "تعذر إنشاء الحساب وقد تحتاج صلاحية مدير مساحة العمل");
      return;
    }
    if (data) setAccounts((current) => [...current, data].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
    setCode(""); setName(""); setCategoryId(""); setParentAccountId(""); setContra(false); setMessage("تمت إضافة الحساب وربطه بالقوائم المالية");
  }

  return (
    <main dir="rtl" className="setup-page">
      <header className="setup-header">
        <div><span>الإعداد المالي</span><h1>دليل الحسابات والتصنيف المالي</h1><p>كل حساب يجب أن يكون مصنفًا ومربوطًا بالقائمة والقسم الذي سيظهر فيه داخل التقارير.</p></div>
        <a href="/dashboard">العودة للوحة الإدارة</a>
      </header>

      <section className="setup-card">
        <h2>1. إنشاء تصنيف حساب</h2>
        <form onSubmit={addCategory} className="category-form">
          <label>اسم التصنيف<input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="مثال: العملاء" /></label>
          <label>القائمة المالية<select value={statementType} onChange={(e) => { setStatementType(e.target.value); setStatementSection(""); }}><option value="">اختر القائمة</option>{statementTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button disabled={categoryLoading}>{categoryLoading ? "جارٍ الحفظ..." : "إنشاء التصنيف"}</button>
        </form>
      </section>

      <section className="setup-card">
        <h2>2. إضافة حساب</h2>
        <form onSubmit={addAccount} className="account-form">
          <label>كود الحساب<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="مثال 4100" /></label>
          <label>اسم الحساب<input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال إيرادات المبيعات" /></label>
          <label>نوع الحساب<select value={accountType} onChange={(e) => setAccountType(e.target.value)}><option value="">اختر النوع</option>{accountTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>القائمة المالية<select value={statementType} onChange={(e) => { setStatementType(e.target.value); setStatementSection(""); }}><option value="">اختر القائمة</option>{statementTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>قسم القائمة<select value={statementSection} onChange={(e) => setStatementSection(e.target.value)} disabled={!statementType}><option value="">اختر القسم</option>{sections.map((section) => <option key={section} value={section}>{section}</option>)}</select></label>
          <label>تصنيف الحساب<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">بدون تصنيف فرعي</option>{categories.filter((c) => !statementType || c.statement_type === statementType).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label>الحساب الأب<select value={parentAccountId} onChange={(e) => setParentAccountId(e.target.value)}><option value="">بدون حساب أب</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
          <label className="check"><input type="checkbox" checked={contra} onChange={(e) => setContra(e.target.checked)} /> حساب عكسي Contra Account</label>
          <div className="derived"><span>الرصيد الطبيعي</span><strong>{accountType ? (normalBalance === "debit" ? "مدين" : "دائن") : "يُحدد بعد اختيار النوع"}</strong></div>
          <button disabled={loading}>{loading ? "جارٍ الحفظ..." : "إضافة الحساب"}</button>
        </form>
        <p className="hint">الرصيد الطبيعي لا يُدخل يدويًا؛ النظام يستنتجه من نوع الحساب، ويعكسه تلقائيًا للحسابات العكسية.</p>
        {message && <p className="setup-message">{message}</p>}
      </section>

      <section className="setup-card">
        <div className="list-heading"><h2>الحسابات الحالية</h2><span>{accounts.length} حساب</span></div>
        {accounts.length === 0 ? <div className="empty-accounts">لا توجد حسابات بعد.</div> : <div className="accounts-table">
          <div className="accounts-row accounts-head"><span>الكود</span><span>الحساب</span><span>النوع</span><span>القائمة / القسم</span><span>الرصيد</span></div>
          {accounts.map((account) => <div className="accounts-row" key={account.id}>
            <span>{account.code}</span><strong>{account.name}</strong>
            <span>{accountTypes.find(([v]) => v === account.account_type)?.[1] ?? "غير مصنف"}</span>
            <span>{statementTypes.find(([v]) => v === account.statement_type)?.[1] ?? "غير مربوط"}{account.statement_section ? ` — ${account.statement_section}` : ""}</span>
            <span>{account.normal_balance === "debit" ? "مدين" : "دائن"}{account.is_contra ? " · عكسي" : ""}</span>
          </div>)}
        </div>}
      </section>

      <style jsx>{`
        .setup-page{min-height:100vh;background:#f7f7f5;color:#171717;padding:48px;max-width:1240px;margin:auto;font-family:Arial,sans-serif}.setup-header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:28px}.setup-header span{font-size:13px;color:#777}.setup-header h1{margin:6px 0;font-size:32px}.setup-header p{margin:0;color:#666}.setup-header a{border:1px solid #ddd;background:#fff;padding:11px 16px;border-radius:8px;color:#171717;text-decoration:none}.setup-card{background:#fff;border:1px solid #e5e5e2;border-radius:12px;padding:24px;margin-bottom:18px;box-shadow:0 4px 18px #00000006}.setup-card h2{margin:0 0 18px;font-size:20px}.account-form,.category-form{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:end}.category-form{grid-template-columns:2fr 1fr auto}.account-form label,.category-form label{display:grid;gap:7px;font-size:13px;color:#555}.account-form input,.account-form select,.category-form input,.category-form select{height:42px;border:1px solid #d8d8d5;border-radius:7px;padding:0 11px;background:#fff;font-size:14px}.account-form button,.category-form button{height:42px;border:0;border-radius:7px;background:#171717;color:#fff;padding:0 20px;cursor:pointer}.account-form button:disabled,.category-form button:disabled{opacity:.55}.check{display:flex!important;align-items:center;gap:8px!important;height:42px}.check input{width:17px;height:17px}.derived{height:42px;border:1px dashed #d8d8d5;border-radius:7px;padding:0 11px;display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#777}.derived strong{color:#171717;font-size:13px}.hint,.setup-message{font-size:13px;color:#666;margin:14px 0 0}.list-heading{display:flex;justify-content:space-between;align-items:center}.list-heading span{font-size:13px;color:#777}.accounts-row{display:grid;grid-template-columns:.7fr 1.4fr .8fr 2fr .8fr;gap:12px;padding:13px 8px;border-top:1px solid #eee;font-size:13px;align-items:center}.accounts-head{color:#777;font-size:12px}.empty-accounts{padding:28px 0;color:#777;text-align:center}@media(max-width:900px){.setup-page{padding:22px 14px}.setup-header{display:block}.setup-header a{display:inline-block;margin-top:18px}.account-form,.category-form{grid-template-columns:1fr}.accounts-row{grid-template-columns:1fr 1.5fr 1fr 2fr 1fr}.setup-header h1{font-size:26px}}
      `}</style>
    </main>
  );
}
