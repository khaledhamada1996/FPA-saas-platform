import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type DynamicReportFilterState = { branch: string; department: string; costCenter: string; region: string; product: string; project: string; account: string };
export type DynamicReportFilterOption = { id: string; code?: string | null; name: string; type?: string | null; statement_type?: string | null; subclassification?: string | null };
export type DynamicReportFilterOptions = { branches: DynamicReportFilterOption[]; departments: DynamicReportFilterOption[]; cost_centers: DynamicReportFilterOption[]; regions: DynamicReportFilterOption[]; products: DynamicReportFilterOption[]; projects: DynamicReportFilterOption[]; accounts: DynamicReportFilterOption[] };
export const emptyDynamicReportFilterOptions: DynamicReportFilterOptions = { branches: [], departments: [], cost_centers: [], regions: [], products: [], projects: [], accounts: [] };
export const emptyDynamicReportFilters: DynamicReportFilterState = { branch: "", department: "", costCenter: "", region: "", product: "", project: "", account: "" };
const supabase = getSupabaseBrowserClient();

export function useDynamicReportFilterOptions(organizationId: string, filters: DynamicReportFilterState, dateRange?: { start: string; end: string }) {
  const [options, setOptions] = useState<DynamicReportFilterOptions>(emptyDynamicReportFilterOptions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  useEffect(() => {
    if (!organizationId) { setOptions(emptyDynamicReportFilterOptions); setLoading(false); return; }
    if (!dateRange?.start || !dateRange?.end) { setOptions(emptyDynamicReportFilterOptions); setLoading(false); return; }
    const currentRequest = ++requestId.current;
    let cancelled = false;
    setLoading(true); setError("");
    void supabase.rpc("get_dynamic_reporting_filter_options", {
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
    }).then(({ data, error: rpcError }) => {
      if (cancelled || currentRequest !== requestId.current) return;
      if (rpcError) { setError(rpcError.message); setOptions(emptyDynamicReportFilterOptions); }
      else setOptions({ ...emptyDynamicReportFilterOptions, ...(data || {}) } as DynamicReportFilterOptions);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [organizationId, dateRange?.start, dateRange?.end, filters.branch, filters.department, filters.costCenter, filters.region, filters.product, filters.project, filters.account]);
  return { options, loading, error };
}

export function getActiveOrganizationId() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem("activeOrganizationId") || window.localStorage.getItem("activeOrganizationId") || "";
}
