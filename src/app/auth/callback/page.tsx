"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage(){
 const router=useRouter(); const searchParams=useSearchParams();
 useEffect(()=>{let active=true;async function complete(){try{const supabase=getSupabaseBrowserClient();const {data,error}=await supabase.auth.getSession();if(error)throw error;if(!active)return;const next=searchParams.get("next");const safeNext=next&&next.startsWith("/")?next:"/start";if(data.session)router.replace(safeNext);else router.replace(`/login?confirmed=1${next?`&next=${encodeURIComponent(safeNext)}`:""}`);}catch{if(active)router.replace("/login?error=confirmation");}}void complete();return()=>{active=false};},[router,searchParams]);
 return <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-5 text-center text-slate-600" dir="rtl"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><p className="font-semibold text-slate-900">جارٍ تأكيد البريد الإلكتروني…</p><p className="mt-2 text-sm">يرجى الانتظار لحظات.</p></div></main>;
}
