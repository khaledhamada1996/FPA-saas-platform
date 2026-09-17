"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type LineageRow = {
  id: string;
  data_source_id: string;
  data_source_name: string | null;
  data_source_type: string | null;
  sync_run_id: string | null;
  sync_status: string | null;
  source_record_key: string | null;
  source_entity_type: string | null;
  normalized_entity_type: string | null;
  normalized_record_id: string | null;
  source_reference: string | null;
  mapping_version: string | null;
  observed_at: string | null;
  created_at: string;
};

type DataLineageRpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

export default function DataLineagePage() {
  const params = useSearchParams();
  const [org, setOrg] = useState("");
  const [rows, setRows] = useState<LineageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const normalizedEntityType = params.get("entityType");
  const normalizedRecordId = params.get("recordId");
  const sourceRecordKey = params.get("sourceKey");

  useEffect(() => {
    const id = window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId") || "";
    setOrg(id);
    if (!id) {
      setError("لم يتم تحديد مساحة العمل.");
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    async function loadLineage() {
      try {
        const result = await ((supabase.rpc as any)(
          "get_data_lineage",
          {
            p_organization_id: id,
            p_normalized_entity_type: normalizedEntityType || null,
            p_normalized_record_id: normalizedRecordId || null,
            p_source_record_key: sourceRecordKey || null,
          },
        ) as Promise<DataLineageRpcResult>);

        if (result.error) setError(result.error.message || "تعذر تحميل سلسلة البيانات.");
        else setRows((result.data || []) as LineageRow[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر تحميل سلسلة البيانات.");
      } finally {
        setLoading(false);
      }
    }

    void loadLineage();
  }, [normalizedEntityType, normalizedRecordId, sourceRecordKey]);

  const title = useMemo(() => {
    if (sourceRecordKey) return `سجل المصدر: ${sourceRecordKey}`;
    if (normalizedRecordId) return `السجل المعياري: ${normalizedRecordId}`;
    return "سلسلة مصدر البيانات";
  }, [sourceRecordKey, normalizedRecordId]);

  const fmtDate = (value: string | null) => value ? new Date(value).toLocaleString("ar-SA") : "—";

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-[#172033]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/workspace/data" className="text-sm font-semibold text-slate-500 hover:text-slate-950">العودة إلى البيانات</a>
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400">DATA LINEAGE</p>
            <h1 className="mt-1 text-base font-bold text-slate-950 sm:text-lg">تتبع مصدر البيانات</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="border-b border-slate-200 pb-7">
          <p className="text-xs font-bold text-slate-400">SOURCE → NORMALIZED → ANALYTICS</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-500">يعرض هذا المسار مصدر السجل، عملية المزامنة، مفتاح السجل الأصلي، مرجع المصدر، وإصدار المطابقة للوصول إلى أصل البيانات دون كشف بيانات من شركة أخرى.</p>
        </div>

        {loading && <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">جاري تحميل سلسلة البيانات…</div>}
        {error && <div className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div>}

        {!loading && !error && (
          <div className="mt-7 space-y-4">
            {!rows.length && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">لا توجد سجلات Lineage مطابقة للمرشح الحالي.</div>}
            {rows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="grid gap-5 lg:grid-cols-4">
                  <div><p className="text-xs text-slate-400">مصدر البيانات</p><p className="mt-1 font-bold text-slate-950">{row.data_source_name || "مصدر غير مسمى"}</p><p className="mt-1 text-xs text-slate-500">{row.data_source_type || "—"}</p></div>
                  <div><p className="text-xs text-slate-400">السجل الأصلي</p><p className="mt-1 break-all font-semibold text-slate-900">{row.source_record_key || "—"}</p><p className="mt-1 text-xs text-slate-500">{row.source_entity_type || "—"}</p></div>
                  <div><p className="text-xs text-slate-400">السجل المعياري</p><p className="mt-1 break-all font-semibold text-slate-900">{row.normalized_record_id || "—"}</p><p className="mt-1 text-xs text-slate-500">{row.normalized_entity_type || "—"}</p></div>
                  <div><p className="text-xs text-slate-400">المزامنة</p><p className="mt-1 font-semibold text-slate-900">{row.sync_status || "—"}</p><p className="mt-1 text-xs text-slate-500">{fmtDate(row.observed_at || row.created_at)}</p></div>
                </div>
                <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
                  <div><span className="text-xs text-slate-400">مرجع المصدر</span><p className="mt-1 break-all font-medium">{row.source_reference || "—"}</p></div>
                  <div><span className="text-xs text-slate-400">إصدار المطابقة</span><p className="mt-1 font-medium">{row.mapping_version || "—"}</p></div>
                  <div><span className="text-xs text-slate-400">Sync Run ID</span><p className="mt-1 break-all font-medium">{row.sync_run_id || "—"}</p></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
