"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ImportInfo = {
  id: string;
  file_name: string;
  status: string;
  row_count: number;
  imported_row_count: number;
  error_count: number;
  warning_count: number;
  mapping_version: string | null;
  organization_id: string;
  created_at: string;
  published_at: string | null;
};

type Source = {
  source_code: string;
  source_name: string;
  row_count: number;
  mapping_id: string | null;
  mapping_status: string | null;
  target_account_id: string | null;
  target_account_code: string | null;
  target_account_name: string | null;
};

type Account = {
  id: string;
  code: string;
  name: string;
  account_type: string | null;
  statement_type: string | null;
  statement_section: string | null;
  parent_account_id: string | null;
  level: number;
  path_code: string;
};

type Recon = {
  status: string;
  difference_minor: number;
  source_row_count: number;
  accepted_row_count: number;
  rejected_row_count: number;
  mapping_version: string;
};

type ReviewData = {
  import: ImportInfo;
  sources: Source[];
  accounts: Account[];
  reconciliation: Recon[];
  audit_events: {
    id: string;
    action: string;
    from_status: string;
    to_status: string;
    created_at: string;
    metadata: Record<string, unknown>;
  }[];
};

const statusLabels: Record<string, string> = {
  mapping_required: "تحتاج مطابقة الحسابات",
  ready_for_review: "جاهزة للمراجعة",
  reconciled: "تمت المطابقة النهائية",
  importing: "جاري النشر",
  imported: "تم الاستيراد",
  published: "منشورة",
  rolled_back: "تم التراجع",
  failed: "فشلت",
  uploaded: "مرفوعة",
  validating: "جاري التحقق",
};

export default function ImportReviewPage() {
  const { importId } = useParams<{ importId: string }>();
  const router = useRouter();
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState("v1");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [rollbackReason, setRollbackReason] = useState("");
  const [permissions, setPermissions] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: result, error: reviewError } = await supabase.rpc(
        "get_import_review",
        { p_import_id: importId },
      );
      if (reviewError) throw reviewError;

      const next = result as ReviewData;
      setData(next);
      setVersion(next.import.mapping_version || "v1");

      const initial: Record<string, string> = {};
      for (const source of next.sources) {
        if (source.target_account_id) initial[source.source_code] = source.target_account_id;
      }
      setTargets(initial);

      const { data: access, error: accessError } = await supabase.rpc(
        "get_my_org_access",
        { p_organization_id: next.import.organization_id },
      );
      if (accessError) throw accessError;

      const granted = new Set<string>();
      for (const row of (access ?? []) as { permission_key: string; granted: boolean }[]) {
        if (row.granted) granted.add(row.permission_key);
      }
      setPermissions(granted);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل مراجعة الاستيراد");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [importId]);

  const filtered = useMemo(
    () =>
      data?.sources.filter((source) =>
        `${source.source_code} ${source.source_name}`.toLowerCase().includes(search.toLowerCase()),
      ) ?? [],
    [data, search],
  );

  async function callRpc(fn: string, args: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const { error: rpcError } = await getSupabaseBrowserClient().rpc(fn, args);
      if (rpcError) throw rpcError;
      await load();
    } catch (rpcError) {
      setError(rpcError instanceof Error ? rpcError.message : "تعذر تنفيذ العملية");
    } finally {
      setSaving(false);
    }
  }

  async function saveMapping(source: Source) {
    const target = targets[source.source_code];
    if (!target) {
      setError("اختر الحساب المالي المستهدف أولًا");
      return;
    }
    const permission = source.mapping_status === "draft" || source.mapping_status === "rejected"
      ? "mapping.edit"
      : "mapping.create";
    if (!permissions.has(permission)) {
      setError("لا تملك الصلاحية المطلوبة لتعديل هذه المطابقة");
      return;
    }
    await callRpc("upsert_account_mapping", {
      p_organization_id: data?.import.organization_id,
      p_mapping_version: version,
      p_source_code: source.source_code,
      p_source_name: source.source_name,
      p_target_account_id: target,
    });
  }

  async function prepare() {
    if (!permissions.has("import.prepare")) {
      setError("لا تملك صلاحية تجهيز الاستيراد للمراجعة");
      return;
    }
    await callRpc("prepare_import_for_review", {
      p_import_id: importId,
      p_mapping_version: version,
    });
  }

  async function reconcile() {
    if (!permissions.has("import.reconcile")) {
      setError("لا تملك صلاحية تنفيذ المطابقة النهائية");
      return;
    }
    await callRpc("reconcile_import", { p_import_id: importId });
  }

  async function publish() {
    if (!permissions.has("actuals.publish")) {
      setError("لا تملك صلاحية نشر Actuals");
      return;
    }
    await callRpc("publish_actuals_from_import", {
      p_import_id: importId,
      p_mapping_version: version,
    });
  }

  async function rollback() {
    if (!permissions.has("import.rollback")) {
      setError("لا تملك صلاحية التراجع عن عملية النشر");
      return;
    }
    if (!rollbackReason.trim()) {
      setError("اكتب سبب التراجع قبل التنفيذ");
      return;
    }
    await callRpc("rollback_actuals_import", {
      p_import_id: importId,
      p_reason: rollbackReason,
    });
    setRollbackReason("");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] p-6 text-[#172033]" dir="rtl">
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-10 text-center">جاري تحميل مراجعة الاستيراد…</div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] p-6 text-[#172033]" dir="rtl">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-800">
          {error}
          <button onClick={() => router.push("/workspace/data")} className="mt-5 block w-full rounded-xl bg-slate-950 px-5 py-3 text-white">العودة للاستيراد</button>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const imp = data.import;
  const recon = data.reconciliation[0];
  const mappingComplete = data.sources.length > 0 && data.sources.every((source) => source.mapping_status === "approved");
  const mappedCount = data.sources.filter((source) => source.target_account_id).length;
  const unmappedCount = data.sources.length - mappedCount;
  const reconciled = imp.status === "reconciled" || imp.status === "published";
  const published = imp.status === "published";
  const rolledBack = imp.status === "rolled_back";
  const canView = permissions.has("import.view") && permissions.has("mapping.view");
  const canCreateMapping = permissions.has("mapping.create");
  const canEditMapping = permissions.has("mapping.edit");
  const canPrepare = permissions.has("import.prepare");
  const canReconcile = permissions.has("import.reconcile");
  const canPublish = permissions.has("actuals.publish");
  const canRollback = permissions.has("import.rollback");

  if (!canView) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] p-6 text-[#172033]" dir="rtl">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h1 className="text-xl font-bold text-slate-950">لا تملك صلاحية مراجعة هذه العملية</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">الوصول إلى الاستيراد والمطابقة يتم على مستوى الصلاحيات الفعلية للمستخدم.</p>
          <button onClick={() => router.push("/workspace/data")} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">العودة إلى الاستيراد</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={() => router.push("/workspace/data")} className="text-sm font-semibold text-slate-500 hover:text-slate-950">العودة للاستيراد</button>
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400">IMPORT JOURNEY</p>
            <h1 className="mt-1 text-base font-bold text-slate-950 sm:text-lg">مراجعة {imp.file_name}</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">الحالة الحالية</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">{statusLabels[imp.status] ?? imp.status}</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{imp.row_count.toLocaleString("ar-SA")} صف</span>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">من الملف إلى البيانات الفعلية: مطابقة الحسابات → مراجعة → مطابقة نهائية → نشر. لا تدخل البيانات في Actuals قبل اجتياز كل مرحلة.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className={`rounded-full px-3 py-2 ${mappingComplete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>1 مطابقة الحسابات</span>
            <span className={`rounded-full px-3 py-2 ${imp.status !== "mapping_required" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>2 مراجعة</span>
            <span className={`rounded-full px-3 py-2 ${reconciled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>3 مطابقة نهائية</span>
            <span className={`rounded-full px-3 py-2 ${published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>4 نشر</span>
          </div>
        </div>

        {error && <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-950">مطابقة حسابات الملف مع دليل حسابات الشركة</h3>
                <p className="mt-1 text-sm text-slate-500">المطابقة تتم فقط مع حسابات الشركة الحالية، وليس مع قائمة حسابات عامة.</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">مطابق: {mappedCount}</span>
                  <span className={`rounded-full px-3 py-1.5 ${unmappedCount ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>غير مطابق: {unmappedCount}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بكود أو اسم الحساب" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 sm:w-64" />
                <button onClick={() => router.push(`/workspace/data/accounts?returnTo=/workspace/data/${importId}`)} className="text-xs font-bold text-slate-700 underline underline-offset-4 hover:text-slate-950">فتح دليل الحسابات لإضافة أو تعديل حساب</button>
              </div>
            </div>

            {unmappedCount > 0 && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <b>هناك {unmappedCount} حسابات مصدر غير مطابقة.</b>
                <span className="mr-1">أنشئ أو عدّل الحساب من دليل الحسابات ثم عد إلى هذه العملية لإكمال المطابقة.</span>
              </div>
            )}

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[860px] text-right text-sm">
                <thead className="border-b border-slate-200 text-xs text-slate-500">
                  <tr><th className="p-3">الحساب المصدر</th><th className="p-3">الصفوف</th><th className="p-3">الحالة</th><th className="p-3">حساب الشركة المستهدف</th><th className="p-3">إجراء</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((source) => {
                    const canSave = source.mapping_status === "approved" ? false : source.mapping_status ? canEditMapping : canCreateMapping;
                    return (
                      <tr key={source.source_code}>
                        <td className="p-3 align-top"><b>{source.source_code}</b><div className="mt-1 text-xs text-slate-500">{source.source_name}</div></td>
                        <td className="p-3 align-top">{source.row_count.toLocaleString("ar-SA")}</td>
                        <td className="p-3 align-top"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{source.mapping_status ?? "غير مطابق"}</span></td>
                        <td className="p-3 align-top">
                          <select value={targets[source.source_code] ?? ""} onChange={(e) => setTargets((v) => ({ ...v, [source.source_code]: e.target.value }))} disabled={source.mapping_status === "approved" || !canSave} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50">
                            <option value="">اختر من دليل حسابات الشركة</option>
                            {data.accounts.map((account) => (
                              <option key={account.id} value={account.id}>{"— ".repeat(Math.max(0, account.level - 1))}{account.code} — {account.name}</option>
                            ))}
                          </select>
                          {source.target_account_id && <p className="mt-1 text-[11px] text-slate-400">المحدد: {source.target_account_code} — {source.target_account_name}</p>}
                        </td>
                        <td className="p-3 align-top"><button disabled={saving || !canSave} onClick={() => saveMapping(source)} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">حفظ المطابقة</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filtered.length && <p className="p-10 text-center text-sm text-slate-500">لا توجد حسابات مطابقة للبحث.</p>}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-slate-950">مراحل دورة الاستيراد</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className={`rounded-xl border p-3 ${mappingComplete ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><b>1. مطابقة الحسابات</b><p className="mt-1 text-xs text-slate-600">يجب أن تكون كل حسابات المصدر مرتبطة بحساب من دليل الشركة.</p></div>
                <div className={`rounded-xl border p-3 ${imp.status !== "mapping_required" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}><b>2. تجهيز للمراجعة</b><p className="mt-1 text-xs text-slate-600">يتم تثبيت إصدار المطابقة ومنع النشر قبل اكتمالها.</p></div>
                <div className={`rounded-xl border p-3 ${reconciled ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}><b>3. المطابقة النهائية</b><p className="mt-1 text-xs text-slate-600">يجب أن يتوازن إجمالي المدين والدائن قبل النشر.</p></div>
                <div className={`rounded-xl border p-3 ${published ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}><b>4. نشر Actuals</b><p className="mt-1 text-xs text-slate-600">بعد النشر تدخل البيانات في النموذج المالي الفعلي.</p></div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-slate-950">إجراءات الدورة</h3>
              <div className="mt-4 space-y-2">
                <button disabled={saving || !mappingComplete || imp.status !== "mapping_required" || !canPrepare} onClick={prepare} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">تجهيز للمراجعة</button>
                <button disabled={saving || imp.status !== "ready_for_review" || !canReconcile} onClick={reconcile} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40">تنفيذ المطابقة النهائية</button>
                <button disabled={saving || imp.status !== "reconciled" || !recon || recon.status !== "passed" || !canPublish} onClick={publish} className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">نشر Actuals</button>
              </div>
              {(!canPrepare || !canReconcile || !canPublish) && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-500">بعض الإجراءات غير متاحة لأن صلاحياتك الحالية لا تتضمنها.</p>}
            </section>

            {recon && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-950">نتيجة المطابقة النهائية</h3>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">الصفوف المقبولة</span><b className="mt-1 block">{recon.accepted_row_count}</b></div>
                  <div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">الفرق</span><b className="mt-1 block">{(Number(recon.difference_minor) / 100).toFixed(2)}</b></div>
                </div>
                <p className={`mt-4 rounded-lg p-3 text-xs font-bold ${recon.status === "passed" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>الحالة: {recon.status === "passed" ? "متوازن" : "غير متوازن"}</p>
              </section>
            )}

            {published && !rolledBack && canRollback && (
              <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-red-800">التراجع عن النشر</h3>
                <p className="mt-2 text-xs leading-6 text-slate-500">التراجع لا يحذف التاريخ؛ يتم وسم الحقائق المنشورة كـ actual_rolled_back مع تسجيل السبب في سجل التدقيق.</p>
                <textarea value={rollbackReason} onChange={(e) => setRollbackReason(e.target.value)} maxLength={2000} placeholder="سبب التراجع" className="mt-3 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm" />
                <button disabled={saving} onClick={rollback} className="mt-2 w-full rounded-xl border border-red-300 px-4 py-3 text-sm font-bold text-red-700 disabled:opacity-40">تنفيذ التراجع</button>
              </section>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
