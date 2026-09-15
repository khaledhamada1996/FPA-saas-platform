"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Account = { id: string; code: string; name: string };
type OpeningRow = { id: string; account_id: string; account_code: string; account_name: string; opening_date: string; debit_minor: number; credit_minor: number; description: string | null; status: string };

const toMinor = (value: string) => { const n = Number(String(value).replace(/,/g, "").trim() || 0); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
const fromMinor = (value: number) => (Number(value || 0) / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const statusLabel = (s: string) => s === "approved" ? "معتمد" : s === "locked" ? "مقفل" : "مسودة";

export default function OpeningBalancesPage() {
  const supabase = getSupabaseBrowserClient();
  const [organizationId, setOrganizationId] = useState("");
  const [date, setDate] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<OpeningRow[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async (org: string, openingDate: string) => {
    setLoading(true); setError("");
    const [{ data: accountData, error: accountError }, { data: openingData, error: openingError }] = await Promise.all([
      supabase.from("accounts").select("id,code,name").eq("organization_id", org).order("code"),
      openingDate ? supabase.rpc("get_opening_balances", { p_organization_id: org, p_opening_date: openingDate }) : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (accountError) setError(accountError.message); else setAccounts((accountData ?? []) as Account[]);
    if (openingError) setError(openingError.message); else setRows((openingData ?? []) as OpeningRow[]);
    setLoading(false);
  };

  useEffect(() => {
    const org = window.sessionStorage.getItem("activeOrganizationId") ?? "";
    const year = new Date().getFullYear();
    const initialDate = `${year}-01-01`;
    setOrganizationId(org); setDate(initialDate);
    if (org) void load(org, initialDate);
  }, []);

  const totals = useMemo(() => rows.reduce((x, r) => ({ debit: x.debit + Number(r.debit_minor || 0), credit: x.credit + Number(r.credit_minor || 0) }), { debit: 0, credit: 0 }), [rows]);
  const difference = totals.debit - totals.credit;
  const draftCount = rows.filter(r => r.status === "draft").length;
  const approvedCount = rows.filter(r => r.status === "approved").length;
  const lockedCount = rows.filter(r => r.status === "locked").length;

  const save = async () => {
    setError(""); setMessage("");
    if (!organizationId || !date || !selectedAccount) return setError("اختر تاريخ الرصيد والحساب أولًا");
    const d = toMinor(debit), c = toMinor(credit);
    if (!Number.isFinite(d) || !Number.isFinite(c) || d < 0 || c < 0 || (d > 0 && c > 0) || (d === 0 && c === 0)) return setError("أدخل قيمة مدينة أو دائنة واحدة فقط وبقيمة صحيحة");
    setWorking(true);
    const { error: saveError } = await supabase.rpc("upsert_opening_balance", { p_organization_id: organizationId, p_account_id: selectedAccount, p_opening_date: date, p_debit_minor: d, p_credit_minor: c, p_currency: "SAR", p_description: description || null, p_status: "draft" });
    setWorking(false);
    if (saveError) return setError(saveError.message);
    setMessage("تم حفظ الرصيد كمسودة"); setDebit(""); setCredit(""); setDescription("");
    await load(organizationId, date);
  };

  const approve = async () => {
    setWorking(true); setError(""); setMessage("");
    const { data, error: e } = await supabase.rpc("approve_opening_balances", { p_organization_id: organizationId, p_opening_date: date });
    setWorking(false);
    if (e) return setError(e.message);
    setMessage(`تم اعتماد ${data?.approved_lines ?? 0} رصيدًا افتتاحيًا بعد التحقق من التوازن`); await load(organizationId, date);
  };

  const lock = async () => {
    setWorking(true); setError(""); setMessage("");
    const { data, error: e } = await supabase.rpc("lock_opening_balances", { p_organization_id: organizationId, p_opening_date: date });
    setWorking(false);
    if (e) return setError(e.message);
    setMessage(`تم قفل ${data?.locked_lines ?? 0} رصيدًا افتتاحيًا`); await load(organizationId, date);
  };

  const remove = async (id: string) => {
    if (!window.confirm("حذف هذا الرصيد الافتتاحي؟")) return;
    setWorking(true); setError(""); setMessage("");
    const { error: e } = await supabase.rpc("delete_opening_balance", { p_organization_id: organizationId, p_id: id });
    setWorking(false);
    if (e) return setError(e.message);
    setMessage("تم حذف المسودة"); await load(organizationId, date);
  };

  const validate = async () => {
    setError(""); setMessage("");
    const { data, error: e } = await supabase.rpc("validate_opening_balances", { p_organization_id: organizationId, p_opening_date: date });
    if (e) return setError(e.message);
    setMessage(data?.balanced ? `الأرصدة المعتمدة متوازنة — ${data.line_count} حساب` : `الأرصدة المعتمدة غير متوازنة — الفرق ${fromMinor(data?.difference_minor ?? 0)} ريال`);
  };

  return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8"><Link href="/workspace/data" className="text-xs text-slate-500 underline underline-offset-4">مركز البيانات المالية</Link><h1 className="mt-2 text-2xl font-bold text-slate-950">الأرصدة الافتتاحية</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">الأرصدة الموجودة قبل بدء حركة القيود اليومية. تُحفظ منفصلة عن القيود، ولا تؤثر على الإيرادات أو المصروفات.</p></div></header>
    <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">مسودات</p><p className="mt-1 text-xl font-bold">{draftCount}</p></div><div className="border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">معتمدة</p><p className="mt-1 text-xl font-bold">{approvedCount}</p></div><div className="border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">مقفلة</p><p className="mt-1 text-xl font-bold">{lockedCount}</p></div></div>
      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">إضافة رصيد افتتاحي</h2><p className="mt-1 text-xs leading-6 text-slate-500">الحفظ يبدأ كمسودة. الاعتماد والقفل يتمان على مستوى تاريخ الافتتاح بعد التحقق من توازن الإجمالي.</p>
          <label className="mt-5 block text-xs font-semibold text-slate-600">تاريخ الافتتاح<input type="date" value={date} onChange={e => { setDate(e.target.value); if (organizationId) void load(organizationId, e.target.value); }} className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label>
          <label className="mt-4 block text-xs font-semibold text-slate-600">الحساب<select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">اختر الحساب</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label>
          <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-slate-600">مدين<input inputMode="decimal" value={debit} onChange={e => setDebit(e.target.value)} className="mt-2 w-full border border-slate-300 px-3 py-2.5 text-sm" placeholder="0.00" /></label><label className="text-xs font-semibold text-slate-600">دائن<input inputMode="decimal" value={credit} onChange={e => setCredit(e.target.value)} className="mt-2 w-full border border-slate-300 px-3 py-2.5 text-sm" placeholder="0.00" /></label></div>
          <label className="mt-4 block text-xs font-semibold text-slate-600">البيان<input value={description} onChange={e => setDescription(e.target.value)} className="mt-2 w-full border border-slate-300 px-3 py-2.5 text-sm" placeholder="رصيد افتتاحي قبل بدء القيود" /></label>
          <button disabled={working} onClick={save} className="mt-5 w-full bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{working ? "جارٍ التنفيذ..." : "حفظ كمسودة"}</button>
          <div className="mt-3 grid grid-cols-2 gap-2"><button disabled={working || draftCount === 0} onClick={approve} className="border border-slate-300 px-3 py-2.5 text-xs font-bold disabled:opacity-40">اعتماد المسودات</button><button disabled={working || rows.length === 0 || draftCount > 0 || difference !== 0} onClick={lock} className="border border-slate-300 px-3 py-2.5 text-xs font-bold disabled:opacity-40">قفل الأرصدة</button></div>
          {error && <p className="mt-4 border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700">{error}</p>}{message && <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-xs leading-6 text-emerald-700">{message}</p>}
        </section>
        <section className="border border-slate-200 bg-white"><div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold">الأرصدة المحفوظة</h2><p className="mt-1 text-xs text-slate-500">{date || "—"} · {rows.length} حساب · الفرق الكلي {fromMinor(difference)} ريال</p></div><button onClick={validate} disabled={working || rows.length === 0} className="border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">التحقق من التوازن</button></div>
          <div className="overflow-x-auto"><table className="w-full text-right text-xs"><thead className="border-b border-slate-200 bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">الحساب</th><th className="px-4 py-3">مدين</th><th className="px-4 py-3">دائن</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">البيان</th><th className="px-4 py-3">إجراء</th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">جارٍ التحميل...</td></tr> : rows.length ? rows.map(r => <tr key={r.id} className="border-b border-slate-100"><td className="px-4 py-3 font-semibold">{r.account_code} — {r.account_name}</td><td className="px-4 py-3">{fromMinor(r.debit_minor)}</td><td className="px-4 py-3">{fromMinor(r.credit_minor)}</td><td className="px-4 py-3">{statusLabel(r.status)}</td><td className="px-4 py-3 text-slate-500">{r.description || "—"}</td><td className="px-4 py-3">{r.status === "draft" ? <button disabled={working} onClick={() => remove(r.id)} className="font-bold text-red-700 disabled:opacity-40">حذف</button> : <span className="text-slate-400">—</span>}</td></tr>) : <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">لا توجد أرصدة افتتاحية لهذا التاريخ بعد</td></tr>}</tbody><tfoot className="border-t border-slate-200 bg-slate-50 font-bold"><tr><td className="px-4 py-3">الإجمالي</td><td className="px-4 py-3">{fromMinor(totals.debit)}</td><td className="px-4 py-3">{fromMinor(totals.credit)}</td><td colSpan={3} className={difference === 0 ? "px-4 py-3 text-emerald-700" : "px-4 py-3 text-red-700"}>الفرق: {fromMinor(difference)} ريال</td></tr></tfoot></table></div>
        </section>
      </div>
    </section>
  </main>;
}
