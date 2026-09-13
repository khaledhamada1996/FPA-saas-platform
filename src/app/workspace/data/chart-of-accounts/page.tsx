"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Row = Record<string, unknown>;
type Account = {
  id: string;
  code: string;
  name: string;
  parent_account_id: string | null;
  account_type: string | null;
  statement_type: string | null;
  statement_section: string | null;
  normal_balance: string;
  is_contra: boolean;
  is_active: boolean;
};

type Batch = {
  id: string;
  organization_id: string;
  file_name: string;
  status: string;
  row_count: number;
  accepted_count: number;
  rejected_count: number;
  error_count: number;
  warning_count: number;
  rows: Array<{
    row_number: number;
    account_code: string;
    account_name: string;
    parent_account_code: string | null;
    account_type: string | null;
    statement_classification: string | null;
    normal_balance: string | null;
    is_contra: boolean;
    is_active: boolean;
    validation_status: string;
    validation_errors: unknown;
  }>;
};

const required = ["كود الحساب", "اسم الحساب"];
const optional = ["الحساب الأب", "نوع الحساب", "تصنيف القائمة", "طبيعة الرصيد", "حساب مقابل", "نشط"];
const aliases: Record<string, string[]> = {
  "كود الحساب": ["كود الحساب", "رقم الحساب", "account_code", "account code", "Account Code", "Account No", "GL Code"],
  "اسم الحساب": ["اسم الحساب", "account_name", "account name", "Account Name", "GL Name"],
  "الحساب الأب": ["الحساب الأب", "parent_account_code", "parent account code", "Parent Account"],
  "نوع الحساب": ["نوع الحساب", "account_type", "account type", "Account Type"],
  "تصنيف القائمة": ["تصنيف القائمة", "statement_classification", "statement classification", "Statement Classification"],
  "طبيعة الرصيد": ["طبيعة الرصيد", "normal_balance", "normal balance", "Normal Balance"],
  "حساب مقابل": ["حساب مقابل", "is_contra", "contra account", "Is Contra"],
  "نشط": ["نشط", "is_active", "active", "Is Active"],
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const mapHeaders = (headers: string[]) => Object.fromEntries([...required, ...optional].map((k) => [k, headers.find((h) => aliases[k].some((a) => norm(a) === norm(h))) || ""]));
const truthy = (v: unknown, fallback: boolean) => {
  if (v === "" || v == null) return fallback;
  return [true, 1, "1", "true", "yes", "نعم", "نشط"].includes(typeof v === "string" ? norm(v) : v as never);
};

export default function ChartOfAccountsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const organizationId = typeof window !== "undefined"
    ? window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId")
    : null;

  const loadAccounts = useCallback(async () => {
    if (!organizationId) return;
    const { data, error: e } = await getSupabaseBrowserClient().rpc("get_chart_of_accounts", { p_organization_id: organizationId });
    if (e) throw e;
    setAccounts((data ?? []) as Account[]);
  }, [organizationId]);

  const loadBatch = useCallback(async (id: string) => {
    const { data, error: e } = await getSupabaseBrowserClient().rpc("get_account_import_batch", { p_batch_id: id });
    if (e) throw e;
    setBatch(data as Batch);
  }, []);

  useEffect(() => {
    loadAccounts().catch((e) => setError(e instanceof Error ? e.message : "تعذر تحميل دليل الحسابات"));
  }, [loadAccounts]);

  async function read(f: File) {
    setFile(f); setRows([]); setHeaders([]); setBatch(null); setError("");
    if (f.size > 20 * 1024 * 1024) { setError("حجم الملف يتجاوز 20MB"); return; }
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw Error("لم يتم العثور على ورقة بيانات");
      const parsed = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
      if (!parsed.length) throw Error("الملف لا يحتوي على بيانات");
      setRows(parsed); setHeaders(Object.keys(parsed[0]));
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر قراءة الملف"); }
  }

  async function createBatch() {
    if (!file || !rows.length || missing.length || !organizationId) return;
    setSaving(true); setError("");
    try {
      const payload = rows.map((r) => ({
        account_code: String(r[mapping["كود الحساب"]] ?? "").trim(),
        account_name: String(r[mapping["اسم الحساب"]] ?? "").trim(),
        parent_account_code: mapping["الحساب الأب"] ? String(r[mapping["الحساب الأب"]] ?? "").trim() || null : null,
        account_type: mapping["نوع الحساب"] ? String(r[mapping["نوع الحساب"]] ?? "").trim() || null : null,
        statement_classification: mapping["تصنيف القائمة"] ? String(r[mapping["تصنيف القائمة"]] ?? "").trim() || null : null,
        normal_balance: mapping["طبيعة الرصيد"] ? String(r[mapping["طبيعة الرصيد"]] ?? "").trim() || null : null,
        is_contra: mapping["حساب مقابل"] ? truthy(r[mapping["حساب مقابل"]], false) : false,
        is_active: mapping["نشط"] ? truthy(r[mapping["نشط"]], true) : true,
      }));
      const { data, error: e } = await getSupabaseBrowserClient().rpc("create_account_import_batch", {
        p_organization_id: organizationId, p_file_name: file.name, p_file_hash: null, p_rows: payload,
      });
      if (e) throw e;
      await loadBatch(data as string);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر إنشاء عملية الاستيراد"); }
    finally { setSaving(false); }
  }

  async function applyBatch() {
    if (!batch || batch.status !== "validated") return;
    setSaving(true); setError("");
    try {
      const { error: e } = await getSupabaseBrowserClient().rpc("apply_account_import_batch", { p_batch_id: batch.id });
      if (e) throw e;
      await loadBatch(batch.id);
      await loadAccounts();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر اعتماد دليل الحسابات"); }
    finally { setSaving(false); }
  }

  function template() {
    const d = [
      { "كود الحساب": "1", "اسم الحساب": "الأصول", "الحساب الأب": "", "نوع الحساب": "asset", "تصنيف القائمة": "balance_sheet", "طبيعة الرصيد": "debit", "حساب مقابل": false, "نشط": true },
      { "كود الحساب": "11", "اسم الحساب": "الأصول المتداولة", "الحساب الأب": "1", "نوع الحساب": "asset", "تصنيف القائمة": "balance_sheet", "طبيعة الرصيد": "debit", "حساب مقابل": false, "نشط": true },
      { "كود الحساب": "1101", "اسم الحساب": "النقدية والبنوك", "الحساب الأب": "11", "نوع الحساب": "asset", "تصنيف القائمة": "balance_sheet", "طبيعة الرصيد": "debit", "حساب مقابل": false, "نشط": true },
      { "كود الحساب": "4", "اسم الحساب": "الإيرادات", "الحساب الأب": "", "نوع الحساب": "revenue", "تصنيف القائمة": "income_statement", "طبيعة الرصيد": "credit", "حساب مقابل": false, "نشط": true },
    ];
    const w = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(w, XLSX.utils.json_to_sheet(d), "دليل الحسابات"); XLSX.writeFile(w, "FPA-chart-of-accounts-template.xlsx");
  }

  const mapping = useMemo(() => mapHeaders(headers), [headers]);
  const missing = required.filter((x) => !mapping[x]);
  const filteredAccounts = useMemo(() => {
    const q = norm(search);
    return accounts.filter((a) => !q || norm(`${a.code} ${a.name}`).includes(q));
  }, [accounts, search]);
  const children = useMemo(() => {
    const m = new Map<string | null, Account[]>();
    for (const a of filteredAccounts) m.set(a.parent_account_id, [...(m.get(a.parent_account_id) || []), a]);
    return m;
  }, [filteredAccounts]);
  const roots = children.get(null) || [];

  function renderTree(parent: string | null, level = 1): React.ReactNode {
    if (level > 6) return null;
    return (children.get(parent) || []).map((a) => {
      const hasChildren = (children.get(a.id) || []).length > 0;
      const open = expanded.has(a.id) || !!search;
      return <div key={a.id}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3" style={{ paddingRight: `${12 + (level - 1) * 28}px` }}>
          {hasChildren ? <button onClick={() => setExpanded((s) => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })} className="h-7 w-7 rounded-lg border text-sm">{open ? "−" : "+"}</button> : <span className="w-7" />}
          <span className="w-12 text-[10px] font-bold text-slate-400">L{level}</span>
          <span className="w-28 font-mono text-xs font-bold text-slate-600">{a.code}</span>
          <span className="font-semibold text-slate-900">{a.name}</span>
          {a.account_type && <span className="mr-auto rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500">{a.account_type}</span>}
        </div>
        {hasChildren && open && renderTree(a.id, level + 1)}
      </div>;
    });
  }

  return <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-slate-900">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5"><a href="/workspace/data" className="text-sm font-semibold text-slate-500">العودة للبيانات والاستيرادات</a><div><p className="text-[10px] font-bold tracking-widest text-slate-400">CHART OF ACCOUNTS</p><h1 className="mt-1 text-xl font-bold">دليل الحسابات</h1></div></div></header>
    <section className="mx-auto max-w-7xl px-4 py-7">
      <div className="border-b pb-6"><h2 className="text-3xl font-bold">دليل الحسابات هو الأساس المالي للنموذج</h2><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-500">أنشئ دليل الحسابات يدويًا أو من Excel/CSV أو عبر التكاملات. يدعم النموذج التسلسل الهرمي حتى 6 مستويات، وبعد الاعتماد يصبح الدليل هو مصدر الحسابات المستهدفة في Mapping.</p></div>

      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">استيراد دليل الحسابات</h3><p className="mt-1 text-xs text-slate-500">الحد الأدنى: كود الحساب واسم الحساب. الحقول الأخرى اختيارية.</p></div><button onClick={template} className="rounded-xl border px-4 py-2 text-xs font-bold">تنزيل القالب</button></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[...required, ...optional].map((x) => <div key={x} className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className={required.includes(x) ? "text-red-500" : "text-slate-400"}>{required.includes(x) ? "*" : "•"}</span> {x}</div>)}</div>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} className="mt-5 block w-full text-sm" />
          {rows.length > 0 && <>
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">تم اكتشاف <b>{rows.length}</b> صفًا. {missing.length ? <span className="text-red-700">الحقول المفقودة: {missing.join("، ")}</span> : <span className="text-emerald-700">الحقول الأساسية مكتملة وسيتم تحويل الملف إلى عملية مراجعة قبل الاعتماد.</span>}</div>
            <div className="mt-4 overflow-auto"><table className="min-w-full text-right text-xs"><thead><tr className="border-b">{headers.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody>{rows.slice(0, 8).map((r, i) => <tr key={i} className="border-b">{headers.map((h) => <td key={h} className="px-3 py-2">{String(r[h] ?? "")}</td>)}</tr>)}</tbody></table></div>
            <button disabled={!!missing.length || saving} onClick={createBatch} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{saving ? "جارٍ إنشاء عملية المراجعة…" : "التحقق وإنشاء عملية للمراجعة"}</button>
          </>}
        </section>

        <aside className="rounded-2xl border bg-white p-5 shadow-sm">
          <h3 className="font-bold">دورة اعتماد دليل الحسابات</h3>
          <div className="mt-4 space-y-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><b>1. الاستيراد</b><p className="mt-1 text-xs text-slate-500">يتم حفظ الملف كعملية مراجعة فقط.</p></div><div className="rounded-xl bg-slate-50 p-3"><b>2. التحقق والمراجعة</b><p className="mt-1 text-xs text-slate-500">تظهر الصفوف وحالتها قبل إدخالها إلى الدليل.</p></div><div className="rounded-xl bg-slate-50 p-3"><b>3. الاعتماد</b><p className="mt-1 text-xs text-slate-500">فقط بعد الاعتماد تُنشأ/تحدّث الحسابات الفعلية.</p></div><div className="rounded-xl bg-slate-50 p-3"><b>4. Mapping</b><p className="mt-1 text-xs text-slate-500">الحسابات المعتمدة تصبح أهداف المطابقة للبيانات المستوردة.</p></div></div>
        </aside>
      </div>

      {batch && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold text-slate-400">IMPORT REVIEW</p><h3 className="mt-1 text-xl font-bold">مراجعة {batch.file_name}</h3><p className="mt-2 text-xs text-slate-500">رقم العملية: <span className="font-mono">{batch.id}</span></p></div><span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">{batch.status === "validated" ? "جاهزة للاعتماد" : batch.status}</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">الصفوف</span><b className="mt-1 block">{batch.row_count}</b></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">مقبولة</span><b className="mt-1 block">{batch.accepted_count}</b></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">أخطاء</span><b className="mt-1 block">{batch.error_count}</b></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">تحذيرات</span><b className="mt-1 block">{batch.warning_count}</b></div></div>
        <div className="mt-5 overflow-auto"><table className="w-full min-w-[900px] text-right text-xs"><thead className="border-b bg-slate-50"><tr><th className="p-3">#</th><th className="p-3">كود الحساب</th><th className="p-3">اسم الحساب</th><th className="p-3">الحساب الأب</th><th className="p-3">النوع</th><th className="p-3">الحالة</th></tr></thead><tbody className="divide-y">{batch.rows.map((r) => <tr key={r.row_number}><td className="p-3">{r.row_number}</td><td className="p-3 font-mono font-bold">{r.account_code}</td><td className="p-3 font-semibold">{r.account_name}</td><td className="p-3">{r.parent_account_code || "—"}</td><td className="p-3">{r.account_type || "—"}</td><td className="p-3">{r.validation_status}</td></tr>)}</tbody></table></div>
        {batch.status === "validated" && batch.error_count === 0 && <div className="mt-5 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><b className="text-emerald-800">العملية جاهزة للاعتماد</b><p className="mt-1 text-xs text-emerald-700">لن تظهر الحسابات في الدليل قبل الضغط على اعتماد دليل الحسابات.</p></div><button disabled={saving} onClick={applyBatch} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{saving ? "جارٍ الاعتماد…" : "اعتماد وإدخال إلى دليل الحسابات"}</button></div>}
        {batch.status === "applied" && <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">تم اعتماد العملية وإدخال الحسابات إلى دليل الحسابات بنجاح.</div>}
      </section>}

      <section className="mt-6 rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-bold">شجرة دليل الحسابات</h3><p className="mt-1 text-xs text-slate-500">المستويات المدعومة: 1 إلى 6. هذه الحسابات هي التي ستظهر لاحقًا كحسابات مستهدفة في Mapping.</p></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالكود أو اسم الحساب" className="w-full rounded-xl border px-4 py-3 text-sm sm:w-72" /></div>
        <div className="p-2">{accounts.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">لا توجد حسابات معتمدة حاليًا. أنشئ عملية استيراد ثم راجعها واعتمدها لتظهر هنا.</div> : roots.length ? renderTree(null) : <div className="p-10 text-center text-sm text-slate-500">لا توجد نتائج مطابقة للبحث.</div>}</div>
      </section>
    </section>
  </main>;
}
