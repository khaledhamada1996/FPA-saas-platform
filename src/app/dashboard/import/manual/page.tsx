"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "../import.css";

type Account = { id: string; code: string; name: string };
type Row = { date: string; journalNo: string; account: string; debit: string; credit: string; note: string };

const emptyRow = (): Row => ({ date: "", journalNo: "", account: "", debit: "", credit: "", note: "" });

function numberValue(value: string) {
  return Number(value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/,/g, "").trim());
}

export default function ManualJournalEntryPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ id: string; count: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: membership, error: membershipError } = await supabase.from("organization_members").select("organization_id").limit(1).maybeSingle();
      if (membershipError || !membership?.organization_id) { setError("يجب تسجيل الدخول أولًا حتى نعرض شجرة الحسابات الخاصة بمساحة العمل."); return; }
      const { data, error: accountsError } = await supabase.from("accounts").select("id,code,name").eq("organization_id", membership.organization_id).order("code");
      if (accountsError) setError(accountsError.message); else setAccounts((data ?? []) as Account[]);
    };
    void load();
  }, []);

  const valid = useMemo(() => {
    if (!rows.length) return false;
    const totals: Record<string, { debit: number; credit: number }> = {};
    for (const row of rows) {
      const debit = numberValue(row.debit || "0");
      const credit = numberValue(row.credit || "0");
      if (!row.date || !row.journalNo || !row.account || !Number.isFinite(debit) || !Number.isFinite(credit)) return false;
      if (debit < 0 || credit < 0 || (debit === 0 && credit === 0) || (debit > 0 && credit > 0)) return false;
      totals[row.journalNo] ??= { debit: 0, credit: 0 };
      totals[row.journalNo].debit += debit;
      totals[row.journalNo].credit += credit;
    }
    return Object.values(totals).every((x) => Math.abs(x.debit - x.credit) <= 0.0001);
  }, [rows]);

  function update(index: number, key: keyof Row, value: string) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
    setDone(null); setError("");
  }
  function addRow() { setRows((current) => [...current, emptyRow()]); }
  function removeRow(index: number) { setRows((current) => current.length === 1 ? current : current.filter((_, i) => i !== index)); }

  async function publish() {
    setError("");
    if (!valid) { setError("أكمل الحقول، واستخدم مدين أو دائن فقط، وتأكد أن كل رقم قيد متوازن."); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: membership, error: membershipError } = await supabase.from("organization_members").select("organization_id").limit(1).maybeSingle();
      if (membershipError || !membership?.organization_id) throw new Error("يجب تسجيل الدخول قبل نشر القيود.");
      const payload = rows.map((row, index) => ({
        date: row.date,
        journal_no: row.journalNo,
        description: row.note || undefined,
        account: accounts.find((a) => a.id === row.account)?.code ?? "",
        debit: numberValue(row.debit || "0"),
        credit: numberValue(row.credit || "0"),
        source_row: index + 1,
      }));
      const { data, error: rpcError } = await supabase.rpc("publish_actual_import", { target_organization_id: membership.organization_id, target_file_name: "manual-journal-entry", target_rows: payload });
      if (rpcError) throw new Error(rpcError.message);
      setDone({ id: data.batch_id, count: data.row_count });
      setRows([emptyRow()]);
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر نشر القيود. لم يتم اعتماد أي صف."); }
    finally { setSaving(false); }
  }

  return <main className="import-page" dir="rtl">
    <header className="import-topbar"><div><p>منصة القائد / قيود اليومية</p><h1>إدخال قيود اليومية يدويًا</h1></div><a href="/dashboard/import">العودة للاستيراد</a></header>
    <section className="import-card">
      <div className="mapping-note"><strong>دقة الإدخال</strong><span>كل سطر يمثل طرفًا من القيد. استخدم مدين أو دائن فقط، وكرر رقم القيد في جميع سطوره. لا يمكن النشر إذا لم يتساوَ إجمالي المدين مع إجمالي الدائن.</span></div>
      {error && <div className="message error">{error}</div>}
      {done && <div className="message" style={{background:"#ecfdf5",border:"1px solid #a7f3d0",color:"#047857"}}>تم اعتماد {done.count} سطر في الدفعة {done.id}</div>}
      {!accounts.length && !error && <div className="next-note">لا توجد شجرة حسابات محملة حتى الآن. أنشئ الحسابات من الإعدادات أولًا.</div>}
      <div className="preview" style={{marginTop:18}}>
        <div className="preview-head"><span>التاريخ</span><span>رقم القيد</span><span>الحساب</span><span>مدين</span><span>دائن</span><span>الوصف</span><span>إجراء</span></div>
        {rows.map((row, index) => <div className="preview-row" key={index}>
          <span><input value={row.date} onChange={(e) => update(index,"date",e.target.value)} type="date" /></span>
          <span><input value={row.journalNo} onChange={(e) => update(index,"journalNo",e.target.value)} placeholder="1001" /></span>
          <span><select value={row.account} onChange={(e) => update(index,"account",e.target.value)}><option value="">اختر الحساب</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.code} — {account.name}</option>)}</select></span>
          <span><input value={row.debit} onChange={(e) => update(index,"debit",e.target.value)} inputMode="decimal" placeholder="0.00" /></span>
          <span><input value={row.credit} onChange={(e) => update(index,"credit",e.target.value)} inputMode="decimal" placeholder="0.00" /></span>
          <span><input value={row.note} onChange={(e) => update(index,"note",e.target.value)} placeholder="اختياري" /></span>
          <span><button className="primary-action" style={{marginTop:0}} onClick={() => removeRow(index)}>حذف</button></span>
        </div>)}
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}><button className="primary-action" onClick={addRow}>إضافة سطر</button><button className="primary-action" disabled={!valid || saving || !accounts.length} onClick={publish}>{saving ? "جارٍ النشر..." : "نشر قيود اليومية"}</button></div>
    </section>
  </main>;
}
