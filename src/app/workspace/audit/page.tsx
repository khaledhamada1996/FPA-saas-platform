"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type EventRow = {
  id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  request_id: string | null;
  before_values: Record<string, unknown> | null;
  after_values: Record<string, unknown> | null;
  created_at: string;
};

const actionLabels: Record<string, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  approve: "اعتماد",
  reject: "رفض",
  submit: "إرسال للمراجعة",
  publish: "نشر",
  rollback: "تراجع",
  import: "استيراد",
  mapping: "مطابقة",
};

function jsonPreview(value: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) return "—";
  return JSON.stringify(value);
}

export default function AuditPage() {
  const supabase = getSupabaseBrowserClient();
  const [org, setOrg] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.sessionStorage.getItem("activeOrganizationId");
    if (!id) {
      setError("لم يتم تحديد الشركة الحالية.");
      setLoading(false);
      return;
    }
    setOrg(id);
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("audit_events")
        .select("id,actor_user_id,action,target_type,target_id,request_id,before_values,after_values,created_at")
        .eq("organization_id", id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (queryError) setError(queryError.message);
      else setEvents((data ?? []) as EventRow[]);
      setLoading(false);
    })();
  }, [supabase]);

  const filtered = useMemo(
    () => events.filter((item) => (!action || item.action === action) && (!targetType || item.target_type === targetType)),
    [events, action, targetType],
  );
  const actions = useMemo(() => [...new Set(events.map((item) => item.action))].sort(), [events]);
  const targetTypes = useMemo(() => [...new Set(events.map((item) => item.target_type))].sort(), [events]);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-xs font-bold tracking-[0.16em] text-slate-400">AUDIT LOG</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">سجل العمليات</h1>
          <p className="mt-1 text-sm text-slate-500">سجل زمني للعمليات المسجلة داخل الشركة مع الفاعل والهدف والتغييرات.</p>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select value={action} onChange={(e) => setAction(e.target.value)} className="input">
              <option value="">كل العمليات</option>
              {actions.map((item) => <option key={item} value={item}>{actionLabels[item] ?? item}</option>)}
            </select>
            <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="input">
              <option value="">كل أنواع الأهداف</option>
              {targetTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-600">{loading ? "جارٍ التحميل…" : `${filtered.length} عملية`}</div>
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-500">الحد الأقصى المعروض 200 عملية</div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-right text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr><th className="px-5 py-3">الوقت</th><th className="px-5 py-3">العملية</th><th className="px-5 py-3">الهدف</th><th className="px-5 py-3">المستخدم</th><th className="px-5 py-3">المعرّف</th><th className="px-5 py-3">قبل</th><th className="px-5 py-3">بعد</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</td>
                    <td className="px-5 py-4 font-bold text-slate-950">{actionLabels[item.action] ?? item.action}</td>
                    <td className="px-5 py-4">{item.target_type}</td>
                    <td className="px-5 py-4 font-mono text-xs">{item.actor_user_id}</td>
                    <td className="px-5 py-4 font-mono text-xs">{item.target_id ?? "—"}</td>
                    <td className="max-w-[260px] px-5 py-4 font-mono text-[11px] leading-5 text-slate-500">{jsonPreview(item.before_values)}</td>
                    <td className="max-w-[260px] px-5 py-4 font-mono text-[11px] leading-5 text-slate-500">{jsonPreview(item.after_values)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length === 0 && <div className="border-t border-slate-100 p-10 text-center text-sm text-slate-500">لا توجد عمليات مسجلة حاليًا. لا توجد بيانات تجريبية.</div>}
        </section>
      </div>
      <div className="mx-auto max-w-[1500px] px-4 pb-8 text-xs text-slate-400 sm:px-6 lg:px-8">الشركة الحالية: {org ?? "—"}</div>
    </main>
  );
}
