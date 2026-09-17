import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type DynamicReportFilterState = { branch: string; department: string; costCenter: string; region: string; product: string; project: string; account: string };
export type DynamicReportFilterOption = { id: string; code?: string | null; name: string; type?: string | null; statement_type?: string | null; subclassification?: string | null };
export type DynamicReportFilterOptions = { branches: DynamicReportFilterOption[]; departments: DynamicReportFilterOption[]; cost_centers: DynamicReportFilterOption[]; regions: DynamicReportFilterOption[]; products: DynamicReportFilterOption[]; projects: DynamicReportFilterOption[]; accounts: DynamicReportFilterOption[] };
export const emptyDynamicReportFilterOptions: DynamicReportFilterOptions = { branches: [], departments: [], cost_centers: [], regions: [], products: [], projects: [], accounts: [] };
export const emptyDynamicReportFilters: DynamicReportFilterState = { branch: "", department: "", costCenter: "", region: "", product: "", project: "", account: "" };
const supabase = getSupabaseBrowserClient();

const CACHE_TTL_MS = 30_000;
const DEBOUNCE_MS = 180;
const cache = new Map<string, { at: number; value: DynamicReportFilterOptions }>();

function cacheKey(organizationId: string, dateRange: { start: string; end: string }, filters: DynamicReportFilterState) {
  return JSON.stringify([organizationId, dateRange.start, dateRange.end, filters.branch, filters.department, filters.costCenter, filters.region, filters.product, filters.project, filters.account]);
}

export function useDynamicReportFilterOptions(organizationId: string, filters: DynamicReportFilterState, dateRange?: { start: string; end: string }) {
  const [options, setOptions] = useState<DynamicReportFilterOptions>(emptyDynamicReportFilterOptions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    if (!organizationId || !dateRange?.start || !dateRange?.end) {
      setOptions(emptyDynamicReportFilterOptions);
      setLoading(false);
      setError("");
      return;
    }

    const currentRequest = ++requestId.current;
    let cancelled = false;
    const key = cacheKey(organizationId, dateRange, filters);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setOptions(cached.value);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    const timer = window.setTimeout(async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc("get_dynamic_reporting_filter_options", {
          p_organization_id: organizationId,
          p_start_date: dateRange.start,
          p_end_date: dateRange.end,
          p_branch_id: filters.branch || null,
          p_department_id: filters.department || null,
          p_cost_center_id: filters.costCenter || null,
          p_region_id: filters.region || null,
          p_product_id: filters.product || null,
          p_project_id: filters.project || null,
          p_account_id: filters.account || null,
        });

        if (cancelled || currentRequest !== requestId.current) return;
        if (rpcError) {
          setError(rpcError.message || "تعذر تحميل خيارات الأبعاد");
          setOptions(emptyDynamicReportFilterOptions);
          return;
        }
        const next = { ...emptyDynamicReportFilterOptions, ...(data || {}) } as DynamicReportFilterOptions;
        cache.set(key, { at: Date.now(), value: next });
        setOptions(next);
      } catch (caught) {
        if (cancelled || currentRequest !== requestId.current) return;
        setError(caught instanceof Error ? caught.message : "تعذر تحميل خيارات الأبعاد");
        setOptions(emptyDynamicReportFilterOptions);
      } finally {
        if (!cancelled && currentRequest === requestId.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [organizationId, dateRange?.start, dateRange?.end, filters.branch, filters.department, filters.costCenter, filters.region, filters.product, filters.project, filters.account]);

  return { options, loading, error };
}

export function getActiveOrganizationId() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId") || "";
}
