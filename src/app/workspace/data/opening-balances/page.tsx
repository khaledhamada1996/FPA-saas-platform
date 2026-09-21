"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Account = { id: string; code: string; name: string };
type Line = { account_id: string; debit: string; credit: string; description: string };
type OpeningRow = { id: string; entry_id: string | null; account_code: string; account_name: string; debit_minor: number; credit_minor: number; description: string | null; status: string };

const toMinor = (v: string) => { const n = Number(String(v).replace(/,/g, "").trim() || 0); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
const fromMinor = (v: number) => (Number(v || 0) / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const statusLabel = (s: string) => s === "approved" ? "معتمد" : s === "locked" ? "مقفل" : "مسودة";
const emptyLine = (): Line => ({ account_id: "", debit: "", credit: "", description: "" });

export default function OpeningBalancesPage() {
  const supabase = getSupabaseBrowserClient();
  const [org, setOrg] = useState(""); const [date, setDate] = useState(""); const [accounts, setAccounts] = useState<Account[]>([]); const [rows, setRows] = useState<OpeningRow[]>([]);
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]); const [description, setDescription] = useState(""); const [editingId, setEditingId] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [working, setWorking] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");

  const load = async (organizationId: string, openingDate: string) => {
    setLoading(true); setError("");
    const [a, r] = await Promise.all([supabase.rpc("get_chart_of_accounts", { p_organization_id: organizationId }), openingDate ? supabase.rpc("get_opening_balances", { p_organization_id: organizationId, p_opening_date: openingDate }) : Promise.resolve({ data: [], error: null } as any)]);
    if (a.error) setError(a.error.message); else setAccounts((a.data ?? []) as Account[]);
    if (r.error) setError(r.error.message); else setRows((r.data ?? []) as OpeningRow[]); setLoading(false);
  };

  useEffect(() => { const organizationId = window.sessionStorage.getItem("activeOrganizationId") ?? ""; const initialDate = `${new Date().getFullYear()}-01-01`; setOrg(organizationId); setDate(initialDate); if (organizationId) void load(organizationId, initialDate); }, []);

  const totals = useMemo(() => lines.reduce((x, l) => ({ debit: x.debit + (Number.isFinite(toMinor(l.debit)) ? toMinor(l.debit) : 0), credit: x.credit + (Number.isFinite(toMinor(l.credit)) ? toMinor(l.credit) : 0) }), { debit: 0, credit: 0 }), [lines]);
  const difference = totals.debit - totals.credit; const draftCount = rows.filter(r => r.status === "draft").length; const approvedCount = rows.filter(r => r.status === "approved").length; const lockedCount = rows.filter(r => r.status === "locked").length;
  const updateLine = (i: number, patch: Partial<Line>) => setLines(prev => prev.map((l, n) => n === i ? { ...l, ...patch } : l));
  const addLine = () => setLines(prev => [...prev, emptyLine()]); const removeLine = (i: number) => setLines(prev => prev.length > 2 ? prev.filter((_, n) => n !== i) : prev);

  const editRow = (row: OpeningRow) => {
    setEditingId(row.id);
    setDate(date);
    setLines([{ account_id: (accounts.find(a => a.code === row.account_code)?.id ?? ""), debit: row.debit_minor ? String(row.debit_minor / 100) : "", credit: row.credit_minor ? String(row.credit_minor / 100) : "", description: row.description ?? "" }]);
    setDescription(row.description ?? "");
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setLines([emptyLine(), emptyLine()]);
    setDescription("");
  };

  const saveEntry = async () => {
    setError(""); setMessage("");
    if (!org || !date) return setError("حدد تاريخ القيد الافتتاحي");
    if (lines.length < 2) return setError("القيد الافتتاحي يجب أن يحتوي على حساب مدين وحساب دائن على الأقل");
    const payload = lines.map(l => ({ account_id: l.account_id, debit_minor: toMinor(l.debit), credit_minor: toMinor(l.credit), description: l.description || description || null }));
    if (payload.some(l => !l.account_id || !Number.isFinite(l.debit_minor) || !Number.isFinite(l.credit_minor) || l.debit_minor < 0 || l.credit_minor < 0 || (l.debit_minor > 0 && l.credit_minor > 0) || (l.debit_minor === 0 && l.credit_minor === 0))) return setError("كل سطر يجب أن يحتوي على حساب ومبلغ مدين أو دائن فقط");
    if (totals.debit !== totals.credit || totals.debit <= 0) return setError("القيد الافتتاحي يجب أن يكون متوازنًا وإجمالي المدين أكبر من صفر");
    setWorking(true);
    if (editingId) {
      const line = payload[0];
      const { error: e } = await supabase.rpc("update_opening_balance", { p_organization_id: org, p_id: editingId, p_account_id: line.account_id, p_opening_date: date, p_debit_minor: line.debit_minor, p_credit_minor: line.credit_minor, p_description: line.description });
      setWorking(false);
      if (e) return setError(e.message);
      setMessage("تم تعديل الرصيد الافتتاحي وإعادته لمسودة؛ يلزم اعتماده مرة أخرى.");
      cancelEdit();
      await load(org, date);
      return;
    }
    const { data, error: e } = await supabase.rpc("create_opening_entry", { p_organization_id: org, p_opening_date: date, p_lines: payload, p_description: description || null });
    setWorking(false);
    if (e) return setError(e.message);
    setMessage(`تم حفظ القيد الافتتاحي كمسودة — ${data?.line_count ?? payload.length} سطر — مدين ${fromMinor(totals.debit)} ودائن ${fromMinor(totals.credit)}`);
    setLines([emptyLine(), emptyLine()]);
    setDescription("");
    await load(org, date);
  };

  const approve = async () => { setWorking(true); setError(""); setMessage(""); const { data, error: e } = await supabase.rpc("approve_opening_balances", { p_organization_id: org, p_opening_date: date }); setWorking(false); if (e) return setError(e.message); setMessage(`تم اعتماد ${data?.approved_lines ?? 0} سطرًا بعد التحقق من التوازن`); await load(org, date); };
  const lock = async () => { setWorking(true); setError(""); setMessage(""); const { data, error: e } = await supabase.rpc("lock_opening_balances", { p_organization_id: org, p_opening_date: date }); setWorking(false); if (e) return setError(e.message); setMessage(`تم قفل ${data?.locked_lines ?? 0} سطرًا`); await load(org, date); };
  const remove = async (row: OpeningRow) => {
    if (!window.confirm(row.status === "approved" ? "سيتم حذف هذا الرصيد الافتتاحي المعتمد نهائيًا من قاعدة البيانات. هل تريد المتابعة؟" : "حذف سطر المسودة نهائيًا؟")) return;
    setWorking(true);
    const { error: e } = await supabase.rpc("delete_opening_balance", { p_organization_id: org, p_id: row.id });
    setWorking(false);
    if (e) setError(e.message); else { setMessage("تم حذف الرصيد الافتتاحي نهائيًا"); await load(org, date); }
  };

  return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8"><Link href="/workspace/data" className="text-xs text-slate-500 underline underline-offset-4">مركز البيانات المالية</Link><h1 className="mt-2 text-2xl font-bold text-slate-950">قيد الأرصدة الافتتاحية</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">القيد الافتتاحي يتكون من طرف مدين وطرف دائن على الأقل، ويمكن توزيع القيمة على عدة حسابات، ولا يُحفظ إلا إذا تساوى إجمالي المدين مع إجمالي الدائن.</p></div></header>
    <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">مسودات</p><p className="mt-1 text-xl font-bold">{draftCount}</p></div><div className="border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">معتمدة</p><p className="mt-1 text-xl font-bold">{approvedCount}</p></div><div className="border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">مقفلة</p><p className="mt-1 text-xl font-bold">{lockedCount}</p></div></div>
      <section className="border border-slate-200 bg-white p-5"><div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)_240px]"><label className="text-xs font-semibold text-slate-600">تاريخ القيد<input type="date" value={date} onChange={e=>{setDate(e.target.value);if(org)void load(org,e.target.value)}} className="mt-2 w-full border border-slate-300 px-3 py-2.5 text-sm"/></label><label className="text-xs font-semibold text-slate-600">البيان العام<input value={description} onChange={e=>setDescription(e.target.value)} className="mt-2 w-full border border-slate-300 px-3 py-2.5 text-sm" placeholder="رصيد افتتاحي قبل بدء حركة القيود اليومية"/></label><div className={`border p-3 text-center ${difference===0&&totals.debit>0?"border-emerald-200 bg-emerald-50":"border-slate-200 bg-slate-50"}`}><p className="text-xs text-slate-500">فرق القيد</p><p className="mt-1 text-lg font-bold">{fromMinor(difference)} ريال</p><p className="mt-1 text-[11px]">{difference===0&&totals.debit>0?"متوازن":"يجب تساوي المدين والدائن"}</p></div></div>
        <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-3">الحساب</th><th className="w-44 px-3 py-3">مدين</th><th className="w-44 px-3 py-3">دائن</th><th className="px-3 py-3">البيان</th><th className="w-14 px-3 py-3"></th></tr></thead><tbody>{lines.map((l,i)=><tr key={i} className="border-b border-slate-100"><td className="px-3 py-2"><select value={l.account_id} onChange={e=>updateLine(i,{account_id:e.target.value})} className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">اختر من دليل الحسابات</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></td><td className="px-3 py-2"><input inputMode="decimal" value={l.debit} onChange={e=>updateLine(i,{debit:e.target.value,credit:""})} className="w-full border border-slate-300 px-3 py-2.5" placeholder="0.00"/></td><td className="px-3 py-2"><input inputMode="decimal" value={l.credit} onChange={e=>updateLine(i,{credit:e.target.value,debit:""})} className="w-full border border-slate-300 px-3 py-2.5" placeholder="0.00"/></td><td className="px-3 py-2"><input value={l.description} onChange={e=>updateLine(i,{description:e.target.value})} className="w-full border border-slate-300 px-3 py-2.5"/></td><td className="px-3 py-2"><button type="button" onClick={()=>removeLine(i)} disabled={lines.length<=2} className="text-xs text-red-600 disabled:text-slate-300">حذف</button></td></tr>)}</tbody><tfoot className="bg-slate-50 font-bold"><tr><td className="px-3 py-3">الإجمالي</td><td className="px-3 py-3">{fromMinor(totals.debit)}</td><td className="px-3 py-3">{fromMinor(totals.credit)}</td><td colSpan={2} className={difference===0&&totals.debit>0?"px-3 py-3 text-emerald-700":"px-3 py-3 text-red-700"}>{difference===0&&totals.debit>0?"القيد متوازن":"القيد غير متوازن"}</td></tr></tfoot></table></div>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={addLine} disabled={!!editingId} className="border border-slate-300 px-4 py-2.5 text-sm font-bold disabled:opacity-40">+ إضافة سطر</button><button type="button" disabled={working} onClick={()=>void saveEntry()} className="bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{working?"جارٍ الحفظ...":editingId?"حفظ التعديل كمسودة":"حفظ القيد كمسودة"}</button>{editingId&&<button type="button" disabled={working} onClick={cancelEdit} className="border border-slate-300 px-5 py-2.5 text-sm font-bold">إلغاء التعديل</button>}<button type="button" disabled={working||draftCount===0} onClick={()=>void approve()} className="border border-slate-300 px-4 py-2.5 text-sm font-bold disabled:opacity-40">اعتماد المسودات</button><button type="button" disabled={working||rows.length===0||draftCount>0} onClick={()=>void lock()} className="border border-slate-300 px-4 py-2.5 text-sm font-bold disabled:opacity-40">قفل الأرصدة</button></div>
        {error&&<p className="mt-4 border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700">{error}</p>}{message&&<p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-xs leading-6 text-emerald-700">{message}</p>}
      </section>
      <section className="mt-5 border border-slate-200 bg-white"><div className="border-b border-slate-200 p-5"><h2 className="text-sm font-bold">القيود المحفوظة</h2><p className="mt-1 text-xs text-slate-500">كل مجموعة تحمل نفس رقم القيد الداخلي تمثل قيدًا افتتاحيًا واحدًا متوازنًا.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-right text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">الحساب</th><th className="px-4 py-3">مدين</th><th className="px-4 py-3">دائن</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">البيان</th><th className="px-4 py-3">إجراء</th></tr></thead><tbody>{loading?<tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">جارٍ التحميل...</td></tr>:rows.length?rows.map(r=><tr key={r.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{r.account_code} — {r.account_name}</td><td className="px-4 py-3">{fromMinor(r.debit_minor)}</td><td className="px-4 py-3">{fromMinor(r.credit_minor)}</td><td className="px-4 py-3">{statusLabel(r.status)}</td><td className="px-4 py-3 text-slate-500">{r.description||"—"}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-3">{r.status!=="locked"&&<><button type="button" onClick={()=>editRow(r)} className="font-bold text-slate-800">تعديل</button><button type="button" onClick={()=>void remove(r)} className="font-bold text-red-700">حذف</button></>}</div></td></tr>):<tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">لا توجد قيود افتتاحية لهذا التاريخ</td></tr>}</tbody></table></div></section>
    </section>
  </main>;
}
