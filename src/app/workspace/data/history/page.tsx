"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ImportItem = {
  id: string;
  input_type: string;
  file_name: string;
  status: string;
  row_count: number;
  imported_row_count: number;
  error_count: number;
  warning_count: number;
  mapping_version: string | null;
  created_at: string;
  published_at: string | null;
  reconciliation_status: string | null;
};

const types: Record<string, string> = {
  actual_journal_transactions: "القيود اليومية / الحركات الفعلية",
  trial_balance: "ميزان المراجعة",
  chart_of_accounts: "دليل الحسابات",
  master_data: "البيانات المرجعية",
  planning_data: "Budget / Forecast",
};

const statuses: Record<string, string> = {
  mapping_required: "تحتاج مطابقة",
  ready_for_review: "جاهزة للمراجعة",
  reconciled: "تمت المطابقة",
  published: "منشورة",
  rolled_back: "تم التراجع",
  failed: "فشلت",
  validated: "تم التحقق",
};

export default function ImportHistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<ImportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.input_type === filter)),
    [items, filter],
  );

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (!userData.user) {
          router.replace("/login?next=/workspace/data/history");
          return;
        }

        const organizationId =
          window.sessionStorage.getItem("activeOrganizationId") ||
          window.localStorage.getItem("activeOrganizationId");

        if (!organizationId) {
          router.replace("/start");
          return;
        }

        const { data, error: historyError } = await supabase.rpc("get_import_history", {
          p_organization_id: organizationId,
          p_input_type: null,
        });

        if (historyError) throw historyError;
        if (active) setItems((data ?? []) as ImportItem[]);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "تعذر تحميل سجل الاستيرادات");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f7f8fa] p-6 text-[#172033]">
        <div className="mx-auto max-w-6xl rounded-2xl border bg-white p-10 text-center">
          جارٍ تحميل سجل الاستيرادات…
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f8fa] text-[#172033]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/workspace/data" className="text-sm font-semibold text-slate-500">
            ← استيراد جديد
          </Link>
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-[.14em] text-slate-400">IMPORT HISTORY</p>
            <h1 className="mt-1 text-lg font-bold text-slate-950">سجل الاستيرادات</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="border-b border-slate-200 pb-7">
          <h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">كل عمليات إدخال البيانات</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-500">
            راجع نوع البيانات ومصدرها وحالتها قبل الانتقال إلى المطابقة والمصالحة والنشر.
          </p>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {[["all", "كل الأنواع"], ...Object.entries(types)].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-2 text-xs font-bold ${
                filter === key
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <section className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1000px] text-right text-sm">
            <thead className="border-b bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="p-4">الملف</th>
                <th className="p-4">نوع البيانات</th>
                <th className="p-4">الحالة</th>
                <th className="p-4">الصفوف</th>
                <th className="p-4">المطابقة</th>
                <th className="p-4">تاريخ الإنشاء</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-bold text-slate-900">{item.file_name}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {item.mapping_version ? `Mapping ${item.mapping_version}` : "لم يعتمد Mapping بعد"}
                    </div>
                  </td>
                  <td className="p-4 text-xs">{types[item.input_type] || item.input_type}</td>
                  <td className="p-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                      {statuses[item.status] || item.status}
                    </span>
                  </td>
                  <td className="p-4">{Number(item.row_count).toLocaleString("ar-SA")}</td>
                  <td className="p-4 text-xs">
                    {item.reconciliation_status ? item.reconciliation_status : "لم تبدأ"}
                  </td>
                  <td className="p-4 text-slate-500">
                    {new Date(item.created_at).toLocaleString("ar-SA")}
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/workspace/data/${item.id}`}
                      className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white"
                    >
                      فتح المراجعة
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-sm text-slate-500">
                    لا توجد عمليات استيراد بهذا النوع.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}
