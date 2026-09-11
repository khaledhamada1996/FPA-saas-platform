"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "../import.css";

type Account = { id: string; code: string; name: string };
type Row = { date: string; account: string; amount: string; note: string };

const emptyRow = (): Row => ({ date: "", account: "", amount: "", note: "" });

function numberValue(value: string) {
  return Number(value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/,/g, "").trim());
}

export default function ManualActualsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ id: string; count: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: membership, error: membershipError } = await supabase.from("organization_members").select("organization_id").limit(1).maybeSingle();
      if (membershipError || !membership?.organization_id) {
        setError("يجب تسجيل الدخول أولًا حتى نعرض شجرة الحسابات الخاصة بمساحة العمل.");
        return;
      }
      const { data, error: accountsError } = await supabase.from("accounts").select("id,code,name").eq("organization_id", membership.organization_id).order("code");
      if (accountsError) setError(accountsError.message);
      else setAccounts((data ?? []) as Account[]);
    };
    void load();
  }, []);

  const valid = useMemo(() => rows.length > 0 && rows.every((row) => row.date && row.account && row.amount !== "" && Number.isFinite(numberValue(row.amount))), [rows]);

  function update(index: number, key: keyof Row, value: string) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
    setDone(null);
    setError("");
  }

  function addRow() { setRows((current) => [...current, emptyRow()]); }
  function removeRow(index: number) { setRows((current) => current.length === 1 ? current : current.filter((_, i) => i !== index)); }

  async function publish() {
    setError("");
    if (!valid) { setError("أكمل التاريخ والحساب والمبلغ في كل صف قبل النشر."); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: membership, error: membershipError } = await supabase.from("organization_members").select("organization_id").limit(1).maybeSingle();
      if (membershipError || !membership?.organization_id) throw new Error("يجب تسجيل الدخول قبل نشر البيانات.");
      const payload = rows.map((row, index) => ({ date: row.date, account: accounts.find((a) => a.id === row.account)?.code ?? "", amount: numberValue(row.amount), source_row: index + 1, note: row.note || undefined }));
      const { data, error: rpcError } = await supabase.rpc("publish_actual_import", { target_organization_id: membership.organization_id, target_file_name: "manual-entry", target_rows: payload });
      if (rpcError) throw new Error(rpcError.message);
      setDone({ id: data.batch_id, count: data.row_count });
      setRows([emptyRow()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر نشر البيانات. لم يتم اعتماد أي صف.");
    } finally { setSaving(false); }
  }

  return <main className="import-page" dir="rtl">
    <header className="import-topbar"><div><p>منصة القائد / البيانات الفعلية</p><h1>إدخال البيانات يدويًا</h1></div><a href="/dashboard/import">العودة للاستيراد</a></header>
    <section className="import-card">
      <div className="mapping-note"><strong>دقة الإدخال</strong><span>الحساب يُختار من شجرة الحسابات ولا يُكتب كنص حر. التاريخ يحدد الفترة تلقائيًا، وأي صف غير صالح يمنع النشر الكامل.</span></div>
      {error && <div className="message error">{error}</div>}
      {done && <div className="message" style={{background:"#ecfdf5",border:"1px solid #a7f3d0",color:"#047857"}}>تم اعتماد {done.count} صف في الدفعة {done.id}</div>}
      {!accounts.length && !error && <div className="next-note">لا توجد شجرة حسابات محملة حتى الآن. أنشئ الحسابات من الإعدادات أولًا.</div>}
      <div className="preview" style={{marginTop:18}}>
        <div className="preview-head"><span>التاريخ</span><span>الحساب</span><span>المبلغ</span><span>الوصف</span><span>إجراء</span></div>
        {rows.map((row, index) => <div className="preview-row" key={index}>
          <span><input value={row.date} onChange={(e) => update(index,"date",e.target.value)} type="date" /></span>
          <span><select value={row.account} onChange={(e) => update(index,"account",e.target.value)}><option value="">اختر الحساب</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.code} — {account.name}</option>)}</select></span>
          <span><input value={row.amount} onChange={(e) => update(index,"amount",e.target.value)} inputMode="decimal" placeholder="0.00" /></span>
          <span><input value={row.note} onChange={(e) => update(index,"note",e.target.value)} placeholder="اختياري" /></span>
          <span><button className="primary-action" style={{marginTop:0}} onClick={() => removeRow(index)}>حذف</button></span>
        </div>)}
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}><button className="primary-action" onClick={addRow}>إضافة صف</button><button className="primary-action" disabled={!valid || saving || !accounts.length} onClick={publish}>{saving ? "جارٍ النشر..." : "نشر البيانات الفعلية"}</button></div>
    </section>
  </main>;
}
