"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function AccountsSetupPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; name: string; normal_balance: string }>>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState<"debit" | "credit">("debit");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: memberships } = await supabase
        .from("organization_members")
        .select("organization_id")
        .limit(1);
      const id = memberships?.[0]?.organization_id ?? null;
      setOrgId(id);
      if (!id) return;
      const { data } = await supabase
        .from("accounts")
        .select("id,code,name,normal_balance")
        .eq("organization_id", id)
        .order("code");
      setAccounts(data ?? []);
    };
    void load();
  }, []);

  async function addAccount(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!orgId || !code.trim() || !name.trim()) {
      setMessage("أدخل كود الحساب واسم الحساب");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("accounts")
      .insert({ organization_id: orgId, code: code.trim(), name: name.trim(), normal_balance: balance })
      .select("id,code,name,normal_balance")
      .single();
    setLoading(false);
    if (error) {
      setMessage(error.code === "23505" ? "كود الحساب موجود بالفعل في مساحة العمل" : "تعذر إنشاء الحساب");
      return;
    }
    if (data) setAccounts((current) => [...current, data].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
    setCode("");
    setName("");
    setMessage("تمت إضافة الحساب");
  }

  return (
    <main dir="rtl" className="setup-page">
      <header className="setup-header">
        <div><span>الإعداد المالي</span><h1>دليل الحسابات</h1><p>أنشئ الحسابات التي سيُربط بها الاستيراد المالي لاحقًا.</p></div>
        <a href="/dashboard">العودة للوحة الإدارة</a>
      </header>

      <section className="setup-card">
        <h2>إضافة حساب</h2>
        <form onSubmit={addAccount} className="account-form">
          <label>كود الحساب<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="مثال 4100" /></label>
          <label>اسم الحساب<input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال إيرادات المبيعات" /></label>
          <label>الرصيد الطبيعي<select value={balance} onChange={(e) => setBalance(e.target.value as "debit" | "credit")}><option value="debit">مدين</option><option value="credit">دائن</option></select></label>
          <button disabled={loading}>{loading ? "جارٍ الحفظ..." : "إضافة الحساب"}</button>
        </form>
        {message && <p className="setup-message">{message}</p>}
      </section>

      <section className="setup-card">
        <div className="list-heading"><h2>الحسابات الحالية</h2><span>{accounts.length} حساب</span></div>
        {accounts.length === 0 ? <div className="empty-accounts">لا توجد حسابات بعد. أضف أول حساب يدويًا أو سنضيف استيراد دليل الحسابات في خطوة لاحقة.</div> : (
          <div className="accounts-table"><div className="accounts-row accounts-head"><span>الكود</span><span>اسم الحساب</span><span>الرصيد الطبيعي</span></div>
            {accounts.map((account) => <div className="accounts-row" key={account.id}><span>{account.code}</span><strong>{account.name}</strong><span>{account.normal_balance === "debit" ? "مدين" : "دائن"}</span></div>)}
          </div>
        )}
      </section>

      <style jsx>{`
        .setup-page{min-height:100vh;background:#f7f7f5;color:#171717;padding:48px;max-width:1180px;margin:auto;font-family:Arial,sans-serif}
        .setup-header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:28px}.setup-header span{font-size:13px;color:#777}.setup-header h1{margin:6px 0;font-size:32px}.setup-header p{margin:0;color:#666}.setup-header a{border:1px solid #ddd;background:#fff;padding:11px 16px;border-radius:8px;color:#171717;text-decoration:none}
        .setup-card{background:#fff;border:1px solid #e5e5e2;border-radius:12px;padding:24px;margin-bottom:18px;box-shadow:0 4px 18px #00000006}.setup-card h2{margin:0 0 18px;font-size:20px}.account-form{display:grid;grid-template-columns:1fr 2fr 1fr auto;gap:12px;align-items:end}.account-form label{display:grid;gap:7px;font-size:13px;color:#555}.account-form input,.account-form select{height:42px;border:1px solid #d8d8d5;border-radius:7px;padding:0 11px;background:#fff;font-size:14px}.account-form button{height:42px;border:0;border-radius:7px;background:#171717;color:#fff;padding:0 20px;cursor:pointer}.account-form button:disabled{opacity:.55}.setup-message{font-size:13px;margin:14px 0 0;color:#555}.list-heading{display:flex;justify-content:space-between;align-items:center}.list-heading span{font-size:13px;color:#777}.accounts-row{display:grid;grid-template-columns:1fr 3fr 1fr;gap:15px;padding:13px 8px;border-top:1px solid #eee;font-size:14px}.accounts-head{color:#777;font-size:12px}.empty-accounts{padding:28px 0;color:#777;text-align:center}
        @media(max-width:760px){.setup-page{padding:22px 14px}.setup-header{display:block}.setup-header a{display:inline-block;margin-top:18px}.account-form{grid-template-columns:1fr}.accounts-row{grid-template-columns:1fr 2fr 1fr;gap:8px}.setup-header h1{font-size:26px}}
      `}</style>
    </main>
  );
}
