"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Entry = {
  id: string;
  date: string;
  journal_no: string;
  description: string;
  account_code: string;
  account_name: string;
  debit: string;
  credit: string;
};

type Account = { id: string; code: string; name: string };

const blank = (): Entry => ({
  id: crypto.randomUUID(),
  date: new Date().toISOString().slice(0, 10),
  journal_no: "",
  description: "",
  account_code: "",
  account_name: "",
  debit: "",
  credit: "",
});

const toNumber = (value: string) => {
  const normalized = value.replace(/\u00a0/g, " ").replace(/,/g, "").replace(/٬/g, "").trim();
  if (!normalized) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
};

export default function ManualEntryPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([blank(), blank()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const totals = useMemo(() => {
    const debit = entries.reduce((sum, row) => sum + (Number.isNaN(toNumber(row.debit)) ? 0 : toNumber(row.debit)), 0);
    const credit = entries.reduce((sum, row) => sum + (Number.isNaN(toNumber(row.credit)) ? 0 : toNumber(row.credit)), 0);
    return { debit, credit, difference: Math.abs(debit - credit) };
  }, [entries]);

  useEffect(() => {
    const loadAccounts = async () => {
      const organizationId = window.sessionStorage.getItem("activeOrganizationId");
      if (!organizationId) { setAccountsLoading(false); return; }
      const { data, error } = await getSupabaseBrowserClient().from("accounts").select("id,code,name").eq("organization_id", organizationId).order("code").limit(5000);
      if (!error) setAccounts((data ?? []) as Account[]);
      setAccountsLoading(false);
    };
    void loadAccounts();
  }, []);

  const chooseAccount = (id: string, accountId: string) => {
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return;
    setEntries((current) => current.map((row) => row.id === id ? { ...row, account_code: account.code, account_name: account.name } : row));
    setError(""); setSuccess("");
  };

  const update = (id: string, key: keyof Entry, value: string) => {
    setEntries((current) => current.map((row) => row.id === id ? { ...row, [key]: value } : row));
    setError("");
    setSuccess("");
  };

  const addRow = () => setEntries((current) => [...current, blank()]);
  const removeRow = (id: string) => setEntries((current) => current.length > 1 ? current.filter((row) => row.id !== id) : current);

  const validate = () => {
    const issues: string[] = [];
    if (!entries.length) issues.push("أضف سطرًا واحدًا على الأقل");
    entries.forEach((row, index) => {
      const line = index + 1;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) issues.push(`السطر ${line}: التاريخ غير صالح`);
      if (!row.journal_no.trim()) issues.push(`السطر ${line}: رقم القيد مفقود`);
      if (!row.description.trim()) issues.push(`السطر ${line}: بيان القيد مفقود`);
      if (!row.account_code.trim()) issues.push(`السطر ${line}: رقم الحساب مفقود`);
      if (!row.account_name.trim()) issues.push(`السطر ${line}: اسم الحساب مفقود`);
      if (!accounts.some((account) => account.code === row.account_code.trim() && account.name === row.account_name.trim())) issues.push(`السطر ${line}: اختر حسابًا من دليل الحسابات`);
      const debit = toNumber(row.debit);
      const credit = toNumber(row.credit);
      if (Number.isNaN(debit) || Number.isNaN(credit)) issues.push(`السطر ${line}: المدين أو الدائن غير صالح`);
      else if (debit < 0 || credit < 0) issues.push(`السطر ${line}: لا يسمح بقيم سالبة`);
      else if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) issues.push(`السطر ${line}: أدخل قيمة مدين أو دائن فقط`);
    });
    if (totals.difference > 0.005) issues.push(`القيد غير متوازن: الفرق ${totals.difference.toFixed(2)}`);
    return issues;
  };

  const save = async () => {
    setError("");
    setSuccess("");
    const issues = validate();
    if (issues.length) {
      setError(issues.slice(0, 8).join("\n"));
      return;
    }
    const organizationId = window.sessionStorage.getItem("activeOrganizationId");
    if (!organizationId) {
      setError("لم يتم تحديد الشركة النشطة");
      return;
    }
    const userResult = await getSupabaseBrowserClient().auth.getUser();
    if (userResult.error || !userResult.data.user) {
      setError("انتهت جلسة الدخول. سجل الدخول مرة أخرى");
      return;
    }
    setSaving(true);
    try {
      const journalNo = entries[0].journal_no.trim();
      const payload = entries.map((row, index) => ({
        date: row.date,
        journal_no: row.journal_no.trim(),
        description: row.description.trim(),
        account_code: row.account_code.trim(),
        account_name: row.account_name.trim(),
        debit: toNumber(row.debit),
        credit: toNumber(row.credit),
        line_no: index + 1,
      }));
      const { data, error: rpcError } = await getSupabaseBrowserClient().rpc("ingest_validated_import", {
        p_organization_id: organizationId,
        p_file_name: `manual-entry-${journalNo || "journal"}.csv`,
        p_file_hash: await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload))).then((buffer) => Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("")),
        p_rows: payload,
      });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("لم يتم إنشاء سجل الإدخال");
      setSuccess("تم حفظ القيد بنجاح");
      setEntries([blank(), blank()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ القيد");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <button type="button" onClick={() => router.push("/workspace/data")} className="mb-1 text-xs text-slate-500 hover:text-slate-950">البيانات</button>
            <h1 className="text-base font-bold">إدخال يدوي</h1>
          </div>
          <button type="button" onClick={() => router.push("/workspace/data")} className="text-xs font-semibold text-slate-600 hover:text-slate-950">رجوع</button>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <p className="text-xs text-slate-500">أنشئ القيد من دليل الحسابات ثم احفظه بعد التحقق من التوازن</p>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span>مدين {totals.debit.toFixed(2)}</span>
            <span>دائن {totals.credit.toFixed(2)}</span>
            <span className={totals.difference > 0.005 ? "text-red-600" : "text-slate-700"}>الفرق {totals.difference.toFixed(2)}</span>
          </div>
        </div>

        {error && <div className="mb-3 whitespace-pre-line border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700">{error}</div>}
        {success && <div className="mb-3 border border-slate-200 bg-white p-3 text-xs text-slate-700">{success}</div>}

        <div className="overflow-x-auto border border-slate-200 bg-white">
          <table className="min-w-[1100px] w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="w-10 border-b border-slate-200 px-2 py-3">#</th>
                <th className="border-b border-slate-200 px-2 py-3 text-right">التاريخ *</th>
                <th className="border-b border-slate-200 px-2 py-3 text-right">رقم القيد *</th>
                <th className="min-w-[220px] border-b border-slate-200 px-2 py-3 text-right">بيان القيد *</th>
                <th className="border-b border-slate-200 px-2 py-3 text-right">رقم الحساب *</th>
                <th className="min-w-[180px] border-b border-slate-200 px-2 py-3 text-right">اسم الحساب *</th>
                <th className="border-b border-slate-200 px-2 py-3 text-right">مدين *</th>
                <th className="border-b border-slate-200 px-2 py-3 text-right">دائن *</th>
                <th className="w-14 border-b border-slate-200 px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row, index) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-2 text-center text-slate-400">{index + 1}</td>
                  <td className="px-2 py-2"><input type="date" value={row.date} onChange={(e)=>update(row.id,"date",e.target.value)} className="h-9 w-full rounded border border-slate-300 px-2 text-xs outline-none focus:border-slate-700"/></td>
                  <td className="px-2 py-2"><input value={row.journal_no} onChange={(e)=>update(row.id,"journal_no",e.target.value)} className="h-9 w-full rounded border border-slate-300 px-2 text-xs outline-none focus:border-slate-700"/></td>
                  <td className="px-2 py-2"><input value={row.description} onChange={(e)=>update(row.id,"description",e.target.value)} className="h-9 w-full rounded border border-slate-300 px-2 text-xs outline-none focus:border-slate-700"/></td>
                  <td className="px-2 py-2"><select value={accounts.find(a=>a.code===row.account_code && a.name===row.account_name)?.id ?? ""} onChange={(e)=>chooseAccount(row.id,e.target.value)} disabled={accountsLoading} className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-slate-700"><option value="">{accountsLoading ? "جارٍ تحميل الحسابات…" : "اختر الحساب"}</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></td>
                  <td className="px-2 py-2"><input value={row.debit} onChange={(e)=>update(row.id,"debit",e.target.value)} inputMode="decimal" className="h-9 w-full rounded border border-slate-300 px-2 text-xs outline-none focus:border-slate-700"/></td>
                  <td className="px-2 py-2"><input value={row.credit} onChange={(e)=>update(row.id,"credit",e.target.value)} inputMode="decimal" className="h-9 w-full rounded border border-slate-300 px-2 text-xs outline-none focus:border-slate-700"/></td>
                  <td className="px-2 py-2 text-center">
                    <button type="button" onClick={() => removeRow(row.id)} disabled={entries.length === 1} className="text-xs font-semibold text-slate-400 hover:text-red-600 disabled:opacity-30">حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={addRow} className="border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:border-slate-600">+ إضافة سطر</button>
          <button type="button" onClick={save} disabled={saving} className="bg-slate-950 px-5 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? "جارٍ الحفظ…" : "حفظ القيد"}</button>
        </div>
      </section>
    </main>
  );
}
