"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Option = { id: string; code?: string; name: string };
export type ReportDimensionFilterState = { branch: string; department: string; costCenter: string; region: string; product: string; project: string; account: string };
export const emptyReportDimensionFilters: ReportDimensionFilterState = { branch: "", department: "", costCenter: "", region: "", product: "", project: "", account: "" };
type Options = { branches: Option[]; departments: Option[]; cost_centers: Option[]; regions: Option[]; products: Option[]; projects: Option[]; accounts: Option[] };
const fallback: Options = { branches: [], departments: [], cost_centers: [], regions: [], products: [], projects: [], accounts: [] };

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
    void supabase.rpc("get_dynamic_reporting_filter_options", {
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
    }).then(({ data, error: rpcError }) => {
      if (cancelled || requestId !== requestRef.current) return;
      if (rpcError) {
        setError(rpcError.message);
      } else if (data) {
        setDynamicOptions({ ...fallback, ...data });
      } else {
        setDynamicOptions(fallback);
      }
      setLoading(false);
    });

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
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`min-h-10 border px-3 text-xs font-bold transition ${count ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}>
      الأبعاد{count ? ` · ${count}` : ""}{loading ? " · …" : ""}⌄
    </button>
    {open && <div className="absolute right-0 top-11 z-50 w-[min(94vw,520px)] border border-slate-200 bg-white p-4 shadow-xl">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <div><p className="text-sm font-bold text-slate-950">أبعاد التقرير</p><p className="mt-1 text-[11px] text-slate-500">الخيارات مبنية على البيانات الفعلية المنشورة والفترة والفلاتر الحالية</p></div>
        <button type="button" onClick={clear} disabled={!count || loading} className="text-[11px] font-bold text-slate-500 disabled:opacity-40">مسح الكل</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([key, label, english, items]) => <label key={key} title={english} className="text-[11px] font-bold text-slate-600">{label}<select value={filters[key]} disabled={loading} onChange={e => setFilters({ ...filters, [key]: e.target.value })} className="mt-1 min-h-10 w-full border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-slate-950 disabled:bg-slate-50"><option value="">الكل</option>{items.map(x => <option key={x.id} value={x.id}>{x.code ? `${x.code} — ` : ""}{x.name}</option>)}</select></label>)}
      </div>
      {error && <p className="mt-3 border border-red-200 bg-red-50 p-2 text-[10px] text-red-700">{error}</p>}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-[10px] text-slate-400">{count ? `تم اختيار ${count} من 7 أبعاد` : "لم يتم اختيار أبعاد"}</span><button type="button" onClick={() => setOpen(false)} className="min-h-9 bg-slate-950 px-4 text-xs font-bold text-white">تم</button></div>
    </div>}
  </div>;
}
