"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function WorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [fiscalMonth, setFiscalMonth] = useState("1");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > 120) {
      setError("أدخل اسم شركة صحيحًا من 2 إلى 120 حرفًا");
      return;
    }

    localStorage.setItem(
      "fpa_demo_workspace",
      JSON.stringify({ name: cleanName, currency, fiscalMonth: Number(fiscalMonth) }),
    );
    router.push("/dashboard");
  }

  return (
    <main className="auth-page" dir="rtl">
      <section className="auth-card workspace-card">
        <div className="auth-mark">ق</div>
        <p className="eyebrow">الخطوة الأولى</p>
        <h1>أنشئ مساحة عمل شركتك</h1>
        <p>أنشئ مساحة عمل تجريبية الآن وابدأ استخدام المنصة مباشرة. سيتم ربطها بالحساب وقاعدة البيانات عند تفعيل التسجيل لاحقًا.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>اسم الشركة<input name="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} placeholder="مثال: شركة النماء التجارية" /></label>
          <label>العملة الأساسية
            <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="SAR">ريال سعودي (SAR)</option>
              <option value="AED">درهم إماراتي (AED)</option>
              <option value="KWD">دينار كويتي (KWD)</option>
              <option value="QAR">ريال قطري (QAR)</option>
              <option value="BHD">دينار بحريني (BHD)</option>
              <option value="OMR">ريال عُماني (OMR)</option>
            </select>
          </label>
          <label>بداية السنة المالية
            <select name="fiscalMonth" value={fiscalMonth} onChange={(e) => setFiscalMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
            </select>
          </label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button type="submit" className="primary-button">إنشاء مساحة العمل</button>
        </form>
      </section>
    </main>
  );
}
