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

const typeLabels: Record<string, string> = { asset: "أصول", liability: "التزامات", equity: "حقوق ملكية", revenue: "إيرادات", expense: "مصروفات" };
const statementLabels: Record<string, string> = { balance_sheet: "الميزانية العمومية", income_statement: "قائمة الدخل", cash_flow: "التدفقات النقدية" };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Account | null>(null);
  const [parentId, setParentId] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visibleLevel, setVisibleLevel] = useState(1);
  const [form, setForm] = useState({ code: "", name: "", account_type: "asset", statement_type: "balance_sheet", statement_section: "", normal_balance: "debit", is_contra: false });
  const organizationId = typeof window !== "undefined" ? window.sessionStorage.getItem("activeOrganizationId") : null;

  const load = useCallback(async () => {
    if (!organizationId) { setError("لم يتم تحديد الشركة النشطة"); setLoading(false); return; }
    setLoading(true); setError("");
    const supabase = getSupabaseBrowserClient();
    const { data, error: rpcError } = await supabase.rpc("get_chart_of_accounts", { p_organization_id: organizationId });
    if (rpcError) setError(rpcError.message); else setAccounts((data ?? []) as Account[]);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ar");
    if (!q) return accounts;
    const matched = new Set<string>();
    accounts.forEach((account) => {
      const haystack = `${account.code} ${account.name}`.toLocaleLowerCase("ar");
      if (haystack.includes(q)) {
        let current: Account | undefined = account;
        while (current) {
          matched.add(current.id);
          current = current.parent_account_id ? accounts.find((a) => a.id === current!.parent_account_id) : undefined;
        }
      }
    });
    return accounts.filter((account) => matched.has(account.id));
  }, [accounts, query]);

  const children = (parent: string | null) => filtered.filter((a) => a.parent_account_id === parent);
  const hasChildren = (accountId: string) => accounts.some((a) => a.parent_account_id === accountId);

  function toggleExpanded(accountId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(accountId)) next.delete(accountId); else next.add(accountId);
      return next;
    });
  }

  function resetForm() {
    setSelected(null); setParentId("");
    setForm({ code: "", name: "", account_type: "asset", statement_type: "balance_sheet", statement_section: "", normal_balance: "debit", is_contra: false });
  }

  function editAccount(account: Account) {
    setSelected(account); setParentId(account.parent_account_id ?? "");
    setForm({ code: account.code, name: account.name, account_type: account.account_type ?? "asset", statement_type: account.statement_type ?? "balance_sheet", statement_section: account.statement_section ?? "", normal_balance: account.normal_balance, is_contra: account.is_contra });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteAccount(account: Account) {
    if (!organizationId) return;
    if (!window.confirm(`هل تريد حذف الحساب «${account.code} — ${account.name}»؟\n\nلا يمكن حذف الحساب إذا كان لديه حسابات تابعة أو كان مستخدمًا في قيود أو موازنات أو توقعات.`)) return;
    setDeletingId(account.id); setError("");
    const result = await getSupabaseBrowserClient().rpc("delete_chart_account", { p_organization_id: organizationId, p_account_id: account.id });
    if (result.error) {
      const messages: Record<string, string> = {
        ACCOUNT_HAS_CHILDREN: "لا يمكن حذف الحساب لأنه يحتوي على حسابات تابعة. احذف أو انقل الحسابات التابعة أولًا.",
        ACCOUNT_IN_USE: "لا يمكن حذف الحساب لأنه مستخدم في بيانات مالية أو موازنات أو توقعات.",
        ACCOUNT_NOT_FOUND: "الحساب غير موجود أو لم يعد ضمن الشركة الحالية.",
        FORBIDDEN: "ليس لديك صلاحية حذف الحساب.",
      };
      const key = result.error.message?.match(/ACCOUNT_[A-Z_]+|FORBIDDEN/)?.[0];
      setError(messages[key ?? ""] ?? result.error.message);
    } else { if (selected?.id === account.id) resetForm(); await load(); }
    setDeletingId(null);
  }

  async function saveAccount() {
    if (!organizationId) return;
    if (!form.code.trim() || !form.name.trim()) { setError("كود الحساب واسم الحساب إلزاميان"); return; }
    setSaving(true); setError("");
    const supabase = getSupabaseBrowserClient();
    const payload = { p_organization_id: organizationId, p_code: form.code, p_name: form.name, p_parent_account_id: parentId || null, p_account_type: form.account_type, p_statement_type: form.statement_type, p_statement_section: form.statement_section || null, p_normal_balance: form.normal_balance, p_is_contra: form.is_contra };
    const result = selected ? await supabase.rpc("update_chart_account", { ...payload, p_account_id: selected.id }) : await supabase.rpc("create_chart_account", payload);
    if (result.error) setError(result.error.message); else { resetForm(); await load(); }
    setSaving(false);
  }

  function renderTree(parent: string | null, isRoot = false) {
    return children(parent).map((account) => {
      const accountHasChildren = hasChildren(account.id);
      const manuallyExpanded = expanded.has(account.id);
      const isSearching = query.trim().length > 0;
      const isVisibleByLevel = isSearching ? true : account.level <= visibleLevel;
      const isExpanded = isSearching ? true : manuallyExpanded;
      const metadata = `${typeLabels[account.account_type ?? ""] ?? "غير مصنف"} · ${statementLabels[account.statement_type ?? ""] ?? "غير مصنف"}`;
      return <div key={account.id} className="relative">
        {isVisibleByLevel && <>
          <div className={`relative group flex min-h-10 items-center gap-2 border-b border-slate-100 px-3 py-1.5 hover:bg-slate-50 sm:px-4 ${isRoot ? "bg-slate-50 border-slate-200" : ""}`} style={{ paddingRight: `${Math.max(1, account.level) * 24}px` }}>
            <span className="pointer-events-none absolute right-0 top-1/2 h-px w-5 bg-slate-300" aria-hidden="true" />
            <div className="relative z-10 flex shrink-0 items-center gap-1 bg-white px-0.5">{accountHasChildren ? <button type="button" onClick={() => toggleExpanded(account.id)} aria-label={`فتح أو تقليص ${account.name}`} title="فتح / تقليص هذا المستوى" className="flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-xs font-bold leading-none text-slate-700 hover:border-slate-500 hover:bg-slate-50">{isExpanded ? "−" : "+"}</button> : <span className="w-5" />}</div>
            <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${isRoot ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500"}`}>{account.level}</span>
            <div className="min-w-0 flex-1 flex items-center gap-3 leading-tight pe-2 sm:pe-0"><p className="shrink-0 font-semibold text-[13px] text-slate-900">{account.code}</p><p className="min-w-0 truncate font-medium text-[13px] text-slate-800">{account.name}</p></div>
            <div className="hidden w-56 shrink-0 text-center text-[11px] font-medium text-slate-400 sm:block" aria-label="تصنيف الحساب">{metadata}</div>
            <div className="relative z-10 flex shrink-0 items-center gap-1 bg-white ps-1"><button type="button" onClick={() => editAccount(account)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100">تعديل</button><button type="button" onClick={() => void deleteAccount(account)} disabled={deletingId === account.id} className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">{deletingId === account.id ? "..." : "حذف"}</button></div>
            <div className="absolute left-1/2 top-full z-20 -translate-x-1/2 pt-1 sm:hidden"><span className="whitespace-nowrap rounded bg-white px-2 py-0.5 text-[9px] font-medium text-slate-400 shadow-sm">{metadata}</span></div>
          </div>
          {accountHasChildren && isExpanded && account.level < 6 && renderTree(account.id)}
        </>}
      </div>;
    });
  }

  const increaseLevel = () => setVisibleLevel((level) => Math.min(6, level + 1));
  const decreaseLevel = () => setVisibleLevel((level) => Math.max(1, level - 1));

  return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"><a href="/workspace" className="text-sm font-semibold text-slate-500 hover:text-slate-950">العودة لمساحة العمل</a><div className="text-right"><p className="text-[10px] font-bold tracking-[0.14em] text-slate-400">CHART OF ACCOUNTS</p><h1 className="mt-1 text-lg font-bold">دليل الحسابات</h1></div></div></header>
    <section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-7 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold text-slate-400">الأساس المحاسبي للنموذج المالي</p></div><div className="flex flex-wrap gap-2"><a href="/workspace/data/chart-of-accounts" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold hover:bg-slate-50">استيراد Excel</a><a href="/workspace/data-monitoring/connectors" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold hover:bg-slate-50">مصادر وربط الأنظمة</a></div></div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="order-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:order-1">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h3 className="font-bold">شجرة دليل الحسابات</h3><p className="mt-1 text-xs text-slate-500">كل ضغطة على + تفتح مستوى كامل، وكل ضغطة على − تغلق مستوى كامل.</p></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالكود أو اسم الحساب" className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 sm:max-w-xs" /></div>
          {loading ? <div className="p-8 text-sm text-slate-500">جارٍ تحميل دليل الحسابات…</div> : filtered.length ? <div className="relative pr-5 sm:pr-7"><div className="absolute right-3 top-0 bottom-0 w-px bg-slate-300 sm:right-5" aria-hidden="true" /><div className="relative z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 sm:px-5"><div className="flex shrink-0 items-center gap-1 bg-white"><button type="button" onClick={increaseLevel} disabled={visibleLevel >= 6} aria-label="فتح المستوى التالي بالكامل" title="فتح مستوى كامل" className="flex h-7 w-7 items-center justify-center rounded border border-slate-400 bg-white text-base font-bold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">+</button><button type="button" onClick={decreaseLevel} disabled={visibleLevel <= 1} aria-label="إغلاق المستوى الحالي بالكامل" title="إغلاق مستوى كامل" className="flex h-7 w-7 items-center justify-center rounded border border-slate-400 bg-white text-base font-bold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">−</button></div><span className="text-[11px] font-bold text-slate-500">المستوى الظاهر: {visibleLevel} من 6</span></div><div className="relative">{renderTree(null, true)}</div></div> : <div className="p-10 text-center text-sm text-slate-500">لا توجد حسابات بعد. أنشئ أول حساب أو استورد دليل الحسابات من Excel.</div>}
        </section>
        <aside className="order-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:order-2"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-400">{selected ? "تعديل حساب" : "حساب جديد"}</p><h3 className="mt-1 font-bold">إدارة الحساب</h3></div>{selected && <button type="button" onClick={resetForm} className="text-xs font-bold text-slate-500">حساب جديد</button>}</div><div className="mt-5 space-y-3"><label className="block text-xs font-bold text-slate-600">كود الحساب<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="مثال 110101" /></label><label className="block text-xs font-bold text-slate-600">اسم الحساب<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="اسم الحساب" /></label><label className="block text-xs font-bold text-slate-600">الحساب الأب<select value={parentId} onChange={(e) => setParentId(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">بدون أب — مستوى 1</option>{accounts.filter((a) => a.id !== selected?.id && a.level < 6).map((a) => <option key={a.id} value={a.id}>{"— ".repeat(a.level - 1)}{a.code} — {a.name} · المستوى {a.level}</option>)}</select></label><label className="block text-xs font-bold text-slate-600">نوع الحساب<select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">{Object.entries(typeLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><label className="block text-xs font-bold text-slate-600">تصنيف القائمة<select value={form.statement_type} onChange={(e) => setForm({ ...form, statement_type: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">{Object.entries(statementLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><label className="block text-xs font-bold text-slate-600">قسم القائمة<input value={form.statement_section} onChange={(e) => setForm({ ...form, statement_section: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="اختياري" /></label><label className="block text-xs font-bold text-slate-600">طبيعة الرصيد<select value={form.normal_balance} onChange={(e) => setForm({ ...form, normal_balance: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="debit">مدين</option><option value="credit">دائن</option></select></label><label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={form.is_contra} onChange={(e) => setForm({ ...form, is_contra: e.target.checked })} /> حساب مقابل Contra</label>{error && <div className="rounded-lg bg-red-50 p-3 text-xs leading-6 text-red-700">{error}</div>}<button type="button" onClick={saveAccount} disabled={saving} className="h-11 w-full rounded-lg bg-slate-950 text-sm font-bold text-white disabled:opacity-50">{saving ? "جارٍ الحفظ…" : selected ? "حفظ التعديلات" : "إنشاء الحساب"}</button></div></aside>
      </div>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600"><strong className="text-slate-900">مصدر الحسابات:</strong> الإدخال اليدوي وExcel يعملان على نفس دليل الحسابات. الربط بالأنظمة يمر عبر طبقة مصادر البيانات، وبعد وصول الحسابات المصدرية إلى Mapping سيظهر هذا الدليل نفسه للاختيار كـ<strong className="text-slate-900"> الحساب المستهدف</strong>، مع منع أي حساب خارج الشركة النشطة.</div>
    </section>
  </main>;
}