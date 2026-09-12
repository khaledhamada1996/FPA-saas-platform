"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function InvitePage(){
  const params=useParams<{token:string}>();
  const router=useRouter();
  const [status,setStatus]=useState<"loading"|"login"|"mismatch"|"success"|"error">("loading");
  const [message,setMessage]=useState("جارٍ التحقق من رابط الدعوة…");
  const [currentEmail,setCurrentEmail]=useState("");

  useEffect(()=>{
    let active=true;
    async function run(){
      const token=typeof params.token==="string"?params.token:"";
      if(!token){if(active){setStatus("error");setMessage("رابط الدعوة غير صالح.");}return;}
      const supabase=getSupabaseBrowserClient();
      const {data:{session}}=await supabase.auth.getSession();
      if(!session){if(active)setStatus("login");return;}
      const email=session.user.email||"";
      if(active)setCurrentEmail(email);
      const {data,error}=await supabase.rpc("accept_team_invite_link",{p_token:token});
      if(error||!data?.ok){
        if(active){
          if(error?.message?.includes("INVITE_EMAIL_MISMATCH")){
            setStatus("mismatch");
            setMessage("هذا الرابط مخصص لحساب بريد إلكتروني مختلف.");
          }else{
            setStatus("error");
            setMessage(error?.message||"رابط الدعوة منتهي أو غير صالح.");
          }
        }
        return;
      }
      window.sessionStorage.setItem("activeOrganizationId",data.organization_id);
      if(active){setStatus("success");setMessage("تم قبول الدعوة وإضافتك إلى الشركة بنجاح.");setTimeout(()=>router.replace("/workspace"),700);}
    }
    void run();
    return()=>{active=false};
  },[params.token,router]);

  return <main className="min-h-screen bg-[#f7f8fa] px-4 py-12 text-[#172033] sm:px-6 sm:py-20" dir="rtl"><section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"><p className="text-xs font-bold tracking-[.14em] text-slate-400">SECURE INVITATION</p><h1 className="mt-3 text-2xl font-bold text-slate-950">دعوة للانضمام إلى الشركة</h1>{status==="loading"&&<p className="mt-6 text-sm leading-7 text-slate-500">{message}</p>}{status==="login"&&<div className="mt-6"><p className="text-sm leading-7 text-slate-600">يجب تسجيل الدخول أو إنشاء حساب باستخدام نفس البريد الإلكتروني الذي أُنشئت له الدعوة.</p><div className="mt-6 grid gap-3"><Link href={`/login?next=/invite/${params.token}`} className="rounded-xl bg-slate-950 px-5 py-3.5 text-center text-sm font-bold text-white">تسجيل الدخول</Link><Link href={`/signup?next=/invite/${params.token}`} className="rounded-xl border border-slate-300 px-5 py-3.5 text-center text-sm font-bold text-slate-900">إنشاء حساب</Link></div></div>}{status==="mismatch"&&<div className="mt-6"><div className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900"><p className="font-bold">هذا الرابط مخصص لحساب آخر</p><p className="mt-1">أنت مسجل الدخول حاليًا باستخدام:</p><p className="font-semibold" dir="ltr">{currentEmail||"حساب مختلف"}</p><p className="mt-1">سجّل الخروج ثم ادخل بالحساب المرتبط بالدعوة لمتابعة الانضمام إلى الشركة.</p></div><button type="button" onClick={async()=>{const supabase=getSupabaseBrowserClient();await supabase.auth.signOut();window.location.reload();}} className="mt-5 block w-full rounded-xl bg-slate-950 px-5 py-3.5 text-center text-sm font-bold text-white">تسجيل الخروج والمتابعة بالحساب الصحيح</button></div>}{status==="success"&&<p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{message}<br/>جارٍ نقلك إلى مساحة العمل…</p>}{status==="error"&&<div className="mt-6"><p className="rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-700">{message}</p><Link href="/login" className="mt-5 block rounded-xl bg-slate-950 px-5 py-3.5 text-center text-sm font-bold text-white">العودة لتسجيل الدخول</Link></div>}</section></main>;
}
