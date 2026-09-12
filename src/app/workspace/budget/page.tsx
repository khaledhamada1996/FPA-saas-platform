"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  submitted: "بانتظار المراجعة",
  changes_requested: "مطلوب تعديل",
  approved: "معتمدة",
  locked: "مقفلة",
};

const stepStatusLabels: Record<string, string> = {
  pending: "بانتظار القرار",
  approved: "تم الاعتماد",
  changes_requested: "طُلب تعديل",
  rejected: "مرفوضة",
  skipped: "غير مفعلة بعد",
};

type Version = {
  id: string;
  organization_id: string;
  version_type: string;
  name: string;
  status: string;
  created_by: string | null;
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  review_note: string | null;
};

type Step = {
  id: string;
  step_order: number;
  step_name: string;
  required_role_key: string | null;
  required_permission_key: string;
  status: string;
  decision_note: string | null;
};

type VersionBundle = { version: Version; steps: Step[] };
type Notification = { id: string; title: string; body: string; entity_id: string | null; created_at: string };

export default function BudgetPage() {
  const supabase = getSupabaseBrowserClient();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionBundle[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => versions.find((item) => item.version.id === selectedId) ?? versions[0] ?? null, [versions, selectedId]);

  const load = useCallback(async (orgId: string) => {
    setLoading(true);
    const { data, error: loadError } = await supabase.rpc("get_planning_workspace", { p_organization_id: orgId });
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }
    const payload = (data ?? {}) as { versions?: VersionBundle[]; notifications?: Notification[] };
    setVersions(payload.versions ?? []);
    setNotifications(payload.notifications ?? []);
    setSelectedId((current) => current ?? payload.versions?.[0]?.version.id ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const id = window.sessionStorage.getItem("activeOrganizationId");
    if (!id) {
      setError("لم يتم تحديد الشركة الحالية.");
      setLoading(false);
      return;
    }
    setOrganizationId(id);
    void load(id);
  }, [load]);

  async function createVersion() {
    if (!organizationId || !name.trim()) return;
    setBusy(true); setError(null);
    const { data, error: createError } = await supabase.rpc("create_planning_version", {
      p_organization_id: organizationId, p_version_type: "budget", p_name: name.trim(),
    });
    if (createError) setError(createError.message);
    else {
      setName(""); setShowCreate(false); setSelectedId(data as string);
      await load(organizationId);
    }
    setBusy(false);
  }

  async function submit() {
    if (!selected) return;
    setBusy(true); setError(null);
    const { error: submitError } = await supabase.rpc("submit_planning_version", { p_planning_version_id: selected.version.id });
    if (submitError) setError(submitError.message);
    else await load(organizationId!);
    setBusy(false);
  }

  async function review(action: "approve" | "changes_requested" | "reject") {
    if (!selected) return;
    if (action !== "approve" && !reviewNote.trim()) {
      setError("اكتب ملاحظة قبل طلب التعديل أو الرفض.");
      return;
    }
    setBusy(true); setError(null);
    const { error: reviewError } = await supabase.rpc("review_planning_version", {
      p_planning_version_id: selected.version.id, p_action: action, p_note: reviewNote.trim() || null,
    });
    if (reviewError) setError(reviewError.message);
    else { setReviewNote(""); await load(organizationId!); }
    setBusy(false);
  }

  async function markNotification(id: string) {
    await supabase.rpc("mark_notification_read", { p_notification_id: id });
    setNotifications((current) => current.filter((item) => item.id !== id));
  }

  const canSubmit = selected?.version.status === "draft" || selected?.version.status === "changes_requested";
  const canReview = selected?.version.status === "submitted";

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div><p className="text-xs font-bold tracking-[0.14em] text-slate-400">BUDGET</p><h1 className="mt-1 text-2xl font-bold text-slate-950">الميزانية والاعتماد</h1><p className="mt-1 text-sm text-slate-500">إدخال → إرسال → مراجعة → تعديل أو اعتماد</p></div>
          <div className="relative">
            <button type="button" onClick={() => setNotifications([])} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">الإشعارات {notifications.length ? `(${notifications.length})` : ""}</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        {notifications.length > 0 && <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-950">التنبيهات</h2><p className="mt-1 text-sm text-slate-500">إشعارات المراجعة والاعتماد الخاصة بك</p></div></div><div className="mt-4 space-y-3">{notifications.map((item) => <button key={item.id} type="button" onClick={() => { if (item.entity_id) setSelectedId(item.entity_id); void markNotification(item.id); }} className="block w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-right hover:border-slate-400"><div className="flex items-start justify-between gap-4"><div><p className="font-bold text-slate-900">{item.title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p></div><span className="shrink-0 text-xs font-semibold text-slate-400">فتح</span></div></button>)}</div></section>}

        <div className="grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-slate-950">خطط الميزانية</h2><button type="button" onClick={() => setShowCreate(true)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">خطة جديدة</button></div>
            <div className="mt-4 space-y-2">{loading ? <p className="p-4 text-sm text-slate-500">جارٍ التحميل…</p> : versions.length === 0 ? <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">لا توجد خطة بعد. أنشئ مسودة ثم ابدأ إدخال البيانات.</div> : versions.map((item) => <button key={item.version.id} type="button" onClick={() => setSelectedId(item.version.id)} className={`w-full rounded-xl border p-4 text-right transition ${selected?.version.id === item.version.id ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-400"}`}><p className="font-bold text-slate-900">{item.version.name}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{new Date(item.version.created_at).toLocaleDateString("ar-SA")}</span><Status status={item.version.status} /></div></button>)}</div>
          </aside>

          <section className="min-w-0">
            {!selected ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h2 className="text-xl font-bold text-slate-950">ابدأ خطة الميزانية</h2><p className="mt-2 text-sm text-slate-500">أنشئ أول نسخة Budget حتى تظهر دورة الاعتماد.</p></div> : <>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-bold text-slate-950">{selected.version.name}</h2><Status status={selected.version.status} /></div><p className="mt-2 text-sm text-slate-500">ميزانية · أُنشئت في {new Date(selected.version.created_at).toLocaleDateString("ar-SA")}</p></div><div className="flex flex-wrap gap-2">{canSubmit && <button disabled={busy} type="button" onClick={() => void submit()} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">إرسال للمراجعة</button>}{selected.version.status === "approved" && <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700">الخطة معتمدة</span>}</div></div>

                <div className="mt-8 grid gap-3 sm:grid-cols-4">{["draft","submitted","changes_requested","approved"].map((status) => <div key={status} className={`rounded-xl border p-4 ${selected.version.status === status ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white"}`}><p className="text-xs font-bold text-slate-400">{status === "draft" ? "01" : status === "submitted" ? "02" : status === "changes_requested" ? "03" : "04"}</p><p className="mt-2 text-sm font-bold text-slate-900">{statusLabels[status]}</p></div>)}</div>

                {selected.version.review_note && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">ملاحظة المراجع</p><p className="mt-2 text-sm leading-7 text-amber-900">{selected.version.review_note}</p></div>}

                <div className="mt-8 border-t border-slate-100 pt-7"><h3 className="font-bold text-slate-950">مسار الاعتماد</h3><div className="mt-4 space-y-3">{selected.steps.length === 0 ? <p className="text-sm text-slate-500">سيظهر مسار الاعتماد بعد إرسال الخطة وفق سياسة الشركة.</p> : selected.steps.map((step) => <div key={step.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-900">{step.step_order}. {step.step_name}</p><p className="mt-1 text-xs text-slate-500">{step.required_role_key ?? "اعتماد ذاتي حسب السياسة"}</p>{step.decision_note && <p className="mt-2 text-sm text-slate-600">{step.decision_note}</p>}</div><span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{stepStatusLabels[step.status] ?? step.status}</span></div>)}</div></div>

                {canReview && <div className="mt-8 border-t border-slate-100 pt-7"><h3 className="font-bold text-slate-950">مراجعة الخطة</h3><p className="mt-1 text-sm text-slate-500">راجع البيانات قبل اتخاذ القرار. عند طلب التعديل ستصل ملاحظتك لصاحب الخطة.</p><textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} className="input mt-4 min-h-[120px]" placeholder="اكتب ملاحظات المراجعة أو سبب طلب التعديل…" /><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} type="button" onClick={() => void review("approve")} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">اعتماد</button><button disabled={busy} type="button" onClick={() => void review("changes_requested")} className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-800 disabled:opacity-50">طلب تعديل</button><button disabled={busy} type="button" onClick={() => void review("reject")} className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 disabled:opacity-50">رفض</button></div></div>}
              </div>
            </>}
          </section>
        </div>
      </div>

      {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true"><h2 className="text-xl font-bold text-slate-950">إنشاء خطة ميزانية</h2><p className="mt-2 text-sm leading-6 text-slate-500">سيتم إنشاء الخطة كمسودة. بعد إدخال البيانات يمكنك إرسالها للمراجعة.</p><input autoFocus value={name} onChange={(event) => setName(event.target.value)} className="input mt-5" placeholder="مثال: Budget 2027" /><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600">إلغاء</button><button disabled={busy || !name.trim()} type="button" onClick={() => void createVersion()} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">إنشاء المسودة</button></div></div></div>}
    </main>
  );
}

function Status({ status }: { status: string }) {
  const styles: Record<string, string> = { draft: "bg-slate-100 text-slate-600", submitted: "bg-blue-50 text-blue-700", changes_requested: "bg-amber-50 text-amber-700", approved: "bg-emerald-50 text-emerald-700", locked: "bg-purple-50 text-purple-700" };
  return <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>{statusLabels[status] ?? status}</span>;
}
