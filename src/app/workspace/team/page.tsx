"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const roles = [
  ["company_admin", "مسؤول الشركة", "إدارة المستخدمين والإعدادات والصلاحيات"],
  ["ceo", "الرئيس التنفيذي", "الرؤية التنفيذية والقرارات"],
  ["cfo", "المدير المالي", "التخطيط والمراجعة والاعتماد"],
  ["finance_manager", "مدير مالي", "التخطيط والتوقعات والتحليل"],
  ["fpa_analyst", "محلل FP&A", "النماذج والتوقعات والسيناريوهات"],
  ["accountant", "محاسب", "الفعلي والاستيراد والمطابقات"],
  ["department_manager", "مدير قسم", "بيانات وأداء القسم"],
  ["sales_manager", "مدير مبيعات", "افتراضات المبيعات"],
  ["hr_manager", "مدير الموارد البشرية", "القوى العاملة"],
  ["procurement_manager", "مدير المشتريات", "المشتريات والتكاليف"],
  ["operations_manager", "مدير العمليات", "المحركات التشغيلية"],
  ["viewer", "مطلع", "عرض البيانات المسموح بها"],
] as const;

const permissions = [
  ["view", "عرض"], ["create", "إنشاء"], ["edit", "تعديل"], ["delete", "حذف"],
  ["import", "استيراد"], ["export", "تصدير"], ["submit", "إرسال"], ["approve", "اعتماد"],
  ["reject", "رفض"], ["lock", "قفل"], ["manage_users", "إدارة المستخدمين"], ["manage_settings", "الإعدادات"],
  ["manage_budget", "الميزانية"], ["manage_forecast", "التوقعات"], ["manage_scenarios", "السيناريوهات"], ["access_ai", "المحلل المالي الذكي"],
] as const;

type Member = { user_id: string; role: string; role_key: string | null; created_at: string };

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedRole, setSelectedRole] = useState("company_admin");
  const [selectedPermission, setSelectedPermission] = useState("view");
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const organizationId = window.sessionStorage.getItem("activeOrganizationId");
      if (!organizationId) return;

      const { data, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id, role, role_key, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true });
      if (membersError) {
        setError("تعذر تحميل أعضاء الشركة.");
        return;
      }
      setMembers(data ?? []);

      const { data: permission } = await supabase.rpc("has_org_permission", {
        p_organization_id: organizationId,
        p_permission_key: "manage_users",
      });
      setCanManage(Boolean(permission));
    }
    void load();
  }, []);

  const roleName = (key: string | null, legacy: string) => roles.find(([role]) => role === (key ?? legacy))?.[1] ?? legacy;

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/workspace" className="text-sm font-semibold text-slate-500 hover:text-slate-950">العودة لمساحة العمل</Link>
          <div className="text-right"><p className="text-xs font-bold tracking-[0.14em] text-slate-400">IDENTITY & ACCESS</p><h1 className="mt-1 font-bold text-slate-950">الفريق والصلاحيات</h1></div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl"><p className="text-xs font-bold text-slate-400">ONE COMPANY · MANY USERS</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">كل عضو يعمل داخل نفس الشركة بصلاحياته ونطاقه</h2><p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base">الأدوار مجرد قوالب. التفويض الحقيقي مبني على الصلاحية + نطاق الشركة أو الفرع أو القسم أو مركز التكلفة. لذلك يمكن أن يعمل فريق من 10 أو 50 شخصًا دون إعطاء الجميع صلاحية الاعتماد أو تعديل كل البيانات.</p></div>
          <button type="button" disabled={!canManage} className="w-full rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">دعوة عضو جديد</button>
        </div>

        {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <Stat label="أعضاء الشركة" value={members.length} />
          <Stat label="قوالب الأدوار" value={roles.length} />
          <Stat label="الصلاحيات المتاحة" value={permissions.length} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5 sm:p-6"><h3 className="font-bold text-slate-950">أعضاء الشركة</h3><p className="mt-1 text-sm text-slate-500">العضوية مرتبطة بالشركة الحالية فقط.</p></div>
            <div className="divide-y divide-slate-100">
              {members.map((member, index) => (
                <div key={member.user_id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">{index + 1}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">عضو الفريق {index + 1}</p><p className="truncate text-xs text-slate-400">{member.user_id}</p></div></div>
                  <div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{roleName(member.role_key, member.role)}</span><button type="button" disabled={!canManage} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40">تعديل الصلاحيات</button></div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="font-bold text-slate-950">معاينة نموذج الصلاحيات</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">اختر دورًا وصلاحية لرؤية طريقة بناء النظام. التخصيص النهائي يكون على مستوى العضو والنطاق.</p>
            <label className="mt-6 block"><span className="mb-2 block text-sm font-semibold text-slate-700">الدور</span><select className="input" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>{roles.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
            <label className="mt-5 block"><span className="mb-2 block text-sm font-semibold text-slate-700">الصلاحية</span><select className="input" value={selectedPermission} onChange={(e) => setSelectedPermission(e.target.value)}>{permissions.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
            <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm leading-7"><p className="font-bold text-slate-900">النطاق</p><div className="mt-3 flex flex-wrap gap-2">{["الشركة","الكيان القانوني","الفرع","القسم","مركز التكلفة","المنطقة","المنتج","المشروع"].map((scope) => <span key={scope} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{scope}</span>)}</div></div>
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-7 text-blue-900"><p className="font-bold">فصل المهام</p><p className="mt-1">من ينشئ الميزانية لا يصبح تلقائيًا صاحب صلاحية اعتمادها. الاعتماد والقفل إجراءات مستقلة ومسجلة.</p></div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p></div>;
}
