"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ImportItem = { id: string; file_name: string; status: string; row_count: number; imported_row_count: number; error_count: number; warning_count: number; mapping_version: string | null; created_at: string; published_at: string | null };

const labels: Record<string, string> = { mapping_required: "تحتاج مطابقة", ready_for_review: "جاهزة للمراجعة", importing: "جاري النشر", imported: "تم الاستيراد", published: "منشورة", rolled_back: "تم التراجع", failed: "فشلت", uploaded: "مرفوعة", validating: "جاري التحقق" };

export default function ImportHistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<ImportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = getSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.replace("/login?next=/workspace/data/history"); return; }
      const organizationId = window.sessionStorage.getItem("activeOrganizationId");
      if (!organizationId) { router.replace("/start"); return; }
      const { data, error: queryError } = await supabase.from("imports").select("id,file_name,status,row_count,imported_row_count,error_count,warning_count,mapping_version,created_at,published_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100);
      if (!active) return;
      if (queryError) setError(queryError.message); else setItems((data ?? []) as ImportItem[]);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  if (loading) return <main className="min-h-screen bg-[#f7f8fa] p-6 text-[#172033]" dir="rtl"><div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-10 text-center">جارٍ تحميل سجل الاستيرادات…</div></main>;

  return <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"><Link href="/workspace/data" className="text-sm font-semibold text-slate-500 hover:text-slate-950">← استيراد جديد</Link><div className="text-right"><p className="text-[10px] font-bold tracking-[0.14em] text-slate-400">IMPORT HISTORY</p><h1 className="mt-1 text-base font-bold text-slate-950 sm:text-lg">سجل الاستيرادات</h1></div></div></header><section className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8"><div className="border-b border-slate-200 pb-7"><p className="text-xs font-bold text-slate-400">دورة البيانات</p><h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">كل عمليات الاستيراد للشركة الحالية</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">يمكنك فتح أي عملية ومتابعة المطابقة والمراجعة والنشر أو التراجع عنها وفق الصلاحيات.</p></div>{error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}<section className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[900px] text-right text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="p-4">الملف</th><th className="p-4">الحالة</th><th className="p-4">الصفوف</th><th className="p-4">المستوردة</th><th className="p-4">الأخطاء</th><th className="p-4">تاريخ الإنشاء</th><th className="p-4"></th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="p-4"><div className="font-bold text-slate-900">{item.file_name}</div><div className="mt-1 text-xs text-slate-400">{item.mapping_version ? `Mapping ${item.mapping_version}` : "لم يعتمد Mapping بعد"}</div></td><td className="p-4"><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${item.status === "published" ? "bg-emerald-50 text-emerald-700" : item.status === "failed" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>{labels[item.status] ?? item.status}</span></td><td className="p-4">{Number(item.row_count).toLocaleString("ar-SA")}</td><td className="p-4">{Number(item.imported_row_count).toLocaleString("ar-SA")}</td><td className="p-4">{Number(item.error_count).toLocaleString("ar-SA")}</td><td className="p-4 text-slate-500">{new Date(item.created_at).toLocaleString("ar-SA")}</td><td className="p-4"><Link href={`/workspace/data/${item.id}`} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white">فتح المراجعة</Link></td></tr>)}{items.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-sm text-slate-500">لا توجد عمليات استيراد لهذه الشركة حتى الآن.</td></tr>}</tbody></table></section></section></main>;
}
