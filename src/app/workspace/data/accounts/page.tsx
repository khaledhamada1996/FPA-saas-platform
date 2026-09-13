"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Account = {
  id: string;
  code: string;
  name: string;
  account_type: string | null;
  statement_type: string | null;
  statement_section: string | null;
  normal_balance: string;
  is_contra: boolean;
  parent_account_id: string | null;
  level: number;
};

const typeLabels: Record<string, string> = {
  asset: "أصول",
  liability: "التزامات",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};
const statementLabels: Record<string, string> = {
  balance_sheet: "الميزانية العمومية",
  income_statement: "قائمة الدخل",
  cash_flow: "التدفقات النقدية",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Account | null>(null);
  const [parentId, setParentId] = useState("");
  const [form, setForm] = useState({ code: "", name: "", account_type: "asset", statement_type: "balance_sheet", statement_section: "", normal_balance: "debit", is_contra: false });

  const organizationId = typeof window !== "undefined" ? window.sessionStorage.getItem("activeOrganizationId") : null;

  const load = useCallback(async () => {
    if (!organizationId) { setError("لم يتم تحديد الشركة النشطة"); setLoading(false); return; }
    setLoading(true); setError("");
    const supabase = getSupabaseBrowserClient();
    const { data, error: rpcError } = await supabase.rpc("get_chart_of_accounts", { p_organization_id: organizationId });
    if (rpcError) setError(rpcError.message);
    else setAccounts((data ?? []) as Account[]);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? accounts.filter((a) => `${a.code} ${a.name}`.toLowerCase().includes(q)) : accounts;
  }, [accounts, query]);

  const roots = filtered.filter((a) => !a.parent_account_id);
  const children = (parent: string | null) => filtered.filter((a) => a.parent_account_id === parent);

  function resetForm() {
    setSelected(null); setParentId("");
    setForm({ code: "", name: "", account_type: "asset", statement_type: "balance_sheet", statement_section: "", normal_balance: "debit", is_contra: false });
  }

  function editAccount(account: Account) {
    setSelected(account); setParentId(account.parent_account_id ?? "");
    setForm({ code: account.code, name: account.name, account_type: account.account_type ?? "asset", statement_type: account.statement_type ?? "balance_sheet", statement_section: account.statement_section ?? "", normal_balance: account.normal_balance, is_contra: account.is_contra });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveAccount() {
    if (!organizationId) return;
    if (!form.code.trim() || !form.name.trim()) { setError("كود الحساب واسم الحساب إلزاميان"); return; }
    setSaving(true); setError("");
    const supabase = getSupabaseBrowserClient();
    const payload = { p_organization_id: organizationId, p_code: form.code, p_name: form.name, p_parent_account_id: parentId || null, p_account_type: form.account_type, p_statement_type: form.statement_type, p_statement_section: form.statement_section || null, p_normal_balance: form.normal_balance, p_is_contra: form.is_contra };
    const result = selected
      ? await supabase.rpc("update_chart_account", { ...payload, p_account_id: selected.id })
      : await supabase.rpc("create_chart_account", payload);
    if (result.error) setError(result.error.message);
    else { resetForm(); await load(); }
    setSaving(false);
  }

  function renderTree(parent: string | null) {
    return children(parent).map((account) => (
      <div key={account.id}>
        <div className="group flex items-center gap-3 border-b border-slate-100 px-4 py-3 hover:bg-slate-50 sm:px-5" style={{ paddingRight: `${Math.max(1, account.level) * 22}px` }}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-bold text-slate-500">{account.level}</span>
          <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{account.code} <span className="font-normal text-slate-600">— {account.name}</span></p><p className="mt-0.5 text-[11px] text-slate-400">{typeLabels[account.account_type ?? ""] ?? "غير مصنف"} · {statementLabels[account.statement_type ?? ""] ?? "غير مصنف"}</p></div>
          <button type="button" onClick={() => editAccount(account)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 opacity-100 hover:bg-slate-100">تعديل</button>
        </div>
        {account.level < 6 && renderTree(account.id)}
      </div>
    ));
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/workspace" className="text-sm font-semibold text-slate-500 hover:text-slate-950">العودة لمساحة العمل</a>
          <div className="text-right"><p className="text-[10px] font-bold tracking-[0.14em] text-slate-400">CHART OF ACCOUNTS</p><h1 className="mt-1 text-lg font-bold">دليل الحسابات</h1></div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-bold text-slate-400">الأساس المحاسبي للنموذج المالي</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">دليل حسابات يصل إلى 6 مستويات</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">أنشئ دليل الحسابات يدويًا أو استورده من Excel. الحسابات هنا هي المرجع الذي سيظهر لاحقًا كـ«الحساب المستهدف» في Mapping لجميع مصادر البيانات.</p></div>
          <div className="flex flex-wrap gap-2"><a href="/workspace/data/chart-of-accounts" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold hover:bg-slate-50">استيراد Excel</a><a href="/workspace/data-monitoring/connectors" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold hover:bg-slate-50">مصادر وربط الأنظمة</a></div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="order-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:order-1">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h3 className="font-bold">شجرة دليل الحسابات</h3><p className="mt-1 text-xs text-slate-500">المستويات المعروضة من 1 إلى 6، ويمكن التفرع داخل كل مستوى.</p></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالكود أو اسم الحساب" className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 sm:max-w-xs" /></div>
            {loading ? <div className="p-8 text-sm text-slate-500">جارٍ تحميل دليل الحسابات…</div> : filtered.length ? <div>{roots.map((root) => <div key={root.id}><div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">1</span><div className="flex-1"><p className="font-bold">{root.code} — {root.name}</p><p className="text-[11px] text-slate-500">{typeLabels[root.account_type ?? ""] ?? "غير مصنف"}</p></div><button type="button" onClick={() => editAccount(root)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold">تعديل</button></div>{root.level < 6 && renderTree(root.id)}</div>)}</div> : <div className="p-10 text-center text-sm text-slate-500">لا توجد حسابات بعد. أنشئ أول حساب أو استورد دليل الحسابات من Excel.</div>}
          </section>

          <aside className="order-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:order-2">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">{selected ? "تعديل حساب" : "حساب جديد"}</p><h3 className="mt-1 font-bold">إدارة الحساب</h3></div>{selected && <button type="button" onClick={resetForm} className="text-xs font-bold text-slate-500">حساب جديد</button>}</div>
            <div className="mt-5 space-y-3">
              <label className="block text-xs font-bold text-slate-600">كود الحساب<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="مثال 110101" /></label>
              <label className="block text-xs font-bold text-slate-600">اسم الحساب<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="اسم الحساب" /></label>
              <label className="block text-xs font-bold text-slate-600">الحساب الأب<select value={parentId} onChange={(e) => setParentId(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">بدون أب — مستوى 1</option>{accounts.filter((a) => a.id !== selected?.id && a.level < 6).map((a) => <option key={a.id} value={a.id}>{"— ".repeat(a.level - 1)}{a.code} — {a.name} · المستوى {a.level}</option>)}</select></label>
              <label className="block text-xs font-bold text-slate-600">نوع الحساب<select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">{Object.entries(typeLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className="block text-xs font-bold text-slate-600">تصنيف القائمة<select value={form.statement_type} onChange={(e) => setForm({ ...form, statement_type: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">{Object.entries(statementLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className="block text-xs font-bold text-slate-600">قسم القائمة<input value={form.statement_section} onChange={(e) => setForm({ ...form, statement_section: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="اختياري" /></label>
              <label className="block text-xs font-bold text-slate-600">طبيعة الرصيد<select value={form.normal_balance} onChange={(e) => setForm({ ...form, normal_balance: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="debit">مدين</option><option value="credit">دائن</option></select></label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={form.is_contra} onChange={(e) => setForm({ ...form, is_contra: e.target.checked })} /> حساب مقابل Contra</label>
              {error && <div className="rounded-lg bg-red-50 p-3 text-xs leading-6 text-red-700">{error}</div>}
              <button type="button" onClick={saveAccount} disabled={saving} className="h-11 w-full rounded-lg bg-slate-950 text-sm font-bold text-white disabled:opacity-50">{saving ? "جارٍ الحفظ…" : selected ? "حفظ التعديلات" : "إنشاء الحساب"}</button>
            </div>
          </aside>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600"><strong className="text-slate-900">مصدر الحسابات:</strong> الإدخال اليدوي وExcel يعملان على نفس دليل الحسابات. الربط بالأنظمة يمر عبر طبقة مصادر البيانات، وبعد وصول الحسابات المصدرية إلى Mapping سيظهر هذا الدليل نفسه للاختيار كـ<strong className="text-slate-900"> الحساب المستهدف</strong>، مع منع أي حساب خارج الشركة النشطة.</div>
      </section>
    </main>
  );
}
