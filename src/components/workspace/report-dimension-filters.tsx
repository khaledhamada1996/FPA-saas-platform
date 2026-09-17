"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Option = { id: string; code?: string; name: string };
export type ReportDimensionFilterState = { branch: string; department: string; costCenter: string; region: string; product: string; project: string; account: string };
export const emptyReportDimensionFilters: ReportDimensionFilterState = { branch: "", department: "", costCenter: "", region: "", product: "", project: "", account: "" };
type Options = { branches: Option[]; departments: Option[]; cost_centers: Option[]; regions: Option[]; products: Option[]; projects: Option[]; accounts: Option[] };
const fallback: Options = { branches: [], departments: [], cost_centers: [], regions: [], products: [], projects: [], accounts: [] };
type DynamicFilterRpcResult = { data: unknown; error: { message?: string } | null };

export function ReportDimensionFilters({
  options,
  filters,
  setFilters,
  dateRange,
}: {
  options?: Options;
  filters: ReportDimensionFilterState;
  setFilters: (v: ReportDimensionFilterState) => void;
  dateRange?: { start?: string | null; end?: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [dynamicOptions, setDynamicOptions] = useState<Options>(options || fallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (options && Object.values(options).some(items => items.length > 0)) setDynamicOptions(options);
  }, [options]);

  useEffect(() => {
    let cancelled = false;
    const organizationId = typeof window !== "undefined"
      ? (window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId") || "")
      : "";
    if (!organizationId) {
      setDynamicOptions(fallback);
      return;
    }

    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const result = await ((supabase.rpc("get_dynamic_reporting_filter_options", {
          p_organization_id: organizationId,
          p_branch_id: filters.branch || null,
          p_department_id: filters.department || null,
          p_cost_center_id: filters.costCenter || null,
          p_region_id: filters.region || null,
          p_product_id: filters.product || null,
          p_project_id: filters.project || null,
          p_account_id: filters.account || null,
          p_start_date: dateRange?.start || null,
          p_end_date: dateRange?.end || null,
        }) as Promise<DynamicFilterRpcResult>));
        if (cancelled || requestId !== requestRef.current) return;
        if (result.error) {
          setError(result.error.message || "تعذر تحميل خيارات الأبعاد.");
        } else if (result.data) {
          setDynamicOptions({ ...fallback, ...(result.data as Partial<Options>) });
        } else {
          setDynamicOptions(fallback);
        }
      } catch (err) {
        if (!cancelled && requestId === requestRef.current) {
          setError(err instanceof Error ? err.message : "تعذر تحميل خيارات الأبعاد.");
        }
      } finally {
        if (!cancelled && requestId === requestRef.current) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [dateRange?.start, dateRange?.end, filters.branch, filters.department, filters.costCenter, filters.region, filters.product, filters.project, filters.account]);

  const normalized = useMemo(() => dynamicOptions || fallback, [dynamicOptions]);
  const fields: [keyof ReportDimensionFilterState, string, string, Option[]][] = [
    ["branch", "الفرع", "Branch", normalized.branches || []],
    ["department", "القسم", "Department", normalized.departments || []],
    ["costCenter", "مركز التكلفة", "Cost center", normalized.cost_centers || []],
    ["region", "المنطقة", "Region", normalized.regions || []],
    ["product", "المنتج", "Product", normalized.products || []],
    ["project", "المشروع", "Project", normalized.projects || []],
    ["account", "الحساب", "Account", normalized.accounts || []],
  ];
  const count = Object.values(filters).filter(Boolean).length;
  const clear = () => setFilters(emptyReportDimensionFilters);

  useEffect(() => {
    const next = { ...filters };
    let changed = false;
    for (const [key, , , items] of fields) {
      if (next[key] && !items.some(item => item.id === next[key])) {
        next[key] = "";
        changed = true;
      }
    }
    if (changed) setFilters(next);
  }, [normalized]);

  return <div className="relative">
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={`erp-button inline-flex items-center gap-1 ${count ? "erp-button-primary" : ""}`}
    >
      الأبعاد{count ? ` · ${count}` : ""}{loading ? " · …" : ""}<span aria-hidden="true">⌄</span>
    </button>
    {open && <div className="erp-panel absolute right-0 top-9 z-50 w-[min(94vw,560px)] p-3">
      <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div><p className="text-xs font-bold text-slate-950">أبعاد التقرير</p><p className="mt-0.5 text-[10px] text-slate-500">الخيارات مبنية على البيانات المنشورة والفترة والفلاتر الحالية</p></div>
        <button type="button" onClick={clear} disabled={!count || loading} className="erp-button h-7 min-h-7 px-2.5 text-[10px] disabled:opacity-40">مسح الكل</button>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {fields.map(([key, label, english, items]) => <label key={key} title={english} className="text-[10px] font-bold text-slate-600">
          {label}
          <select value={filters[key]} disabled={loading} onChange={e => setFilters({ ...filters, [key]: e.target.value })} className="erp-control mt-1 block w-full text-slate-900 outline-none disabled:bg-slate-50">
            <option value="">الكل</option>
            {items.map(x => <option key={x.id} value={x.id}>{x.code ? `${x.code} — ` : ""}{x.name}</option>)}
          </select>
        </label>)}
      </div>
      {error && <p className="mt-2.5 border border-red-200 bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5">
        <span className="text-[10px] text-slate-400">{count ? `تم اختيار ${count} من 7 أبعاد` : "لم يتم اختيار أبعاد"}</span>
        <button type="button" onClick={() => setOpen(false)} className="erp-button erp-button-primary">تم</button>
      </div>
    </div>}
  </div>;
}
