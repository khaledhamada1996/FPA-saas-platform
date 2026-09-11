"use client";

import { useMemo, useState } from "react";

type Account = { sourceCode: string; sourceName: string; type: string; mappedCode: string; mappedName: string };

const initialAccounts: Account[] = [
  { sourceCode: "1000", sourceName: "البنك", type: "أصول", mappedCode: "", mappedName: "" },
  { sourceCode: "1100", sourceName: "العملاء", type: "أصول", mappedCode: "", mappedName: "" },
  { sourceCode: "4000", sourceName: "الإيرادات", type: "إيرادات", mappedCode: "", mappedName: "" },
  { sourceCode: "5000", sourceName: "تكلفة المبيعات", type: "مصروفات", mappedCode: "", mappedName: "" },
  { sourceCode: "6000", sourceName: "المصروفات التشغيلية", type: "مصروفات", mappedCode: "", mappedName: "" },
];

const targetAccounts = [
  { code: "1000", name: "النقدية والبنوك", type: "أصول" },
  { code: "1100", name: "الذمم المدينة", type: "أصول" },
  { code: "4000", name: "الإيرادات", type: "إيرادات" },
  { code: "5000", name: "تكلفة المبيعات", type: "مصروفات" },
  { code: "6000", name: "المصروفات التشغيلية", type: "مصروفات" },
];

export default function AccountsMappingPage() {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((account) => `${account.sourceCode} ${account.sourceName}`.toLowerCase().includes(q));
  }, [accounts, query]);

  const mappedCount = accounts.filter((account) => account.mappedCode).length;

  function autoMap() {
    setAccounts((current) => current.map((account) => {
      const match = targetAccounts.find((target) => target.code === account.sourceCode);
      return match ? { ...account, mappedCode: match.code, mappedName: match.name } : account;
    }));
    setSaved(false);
  }

  function setMapping(sourceCode: string, value: string) {
    const target = targetAccounts.find((item) => item.code === value);
    setAccounts((current) => current.map((account) => account.sourceCode === sourceCode ? { ...account, mappedCode: target?.code ?? "", mappedName: target?.name ?? "" } : account));
    setSaved(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/workspace" className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-950 sm:text-sm">العودة لمساحة العمل</a>
          <div className="min-w-0 text-right"><p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 sm:text-xs">ACCOUNT MAPPING</p><h1 className="mt-1 truncate text-base font-bold text-slate-950 sm:text-lg">شجرة الحسابات والمطابقة</h1></div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
        <div className="border-b border-slate-200 pb-7 sm:pb-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400 sm:text-sm">المرحلة الثانية</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">مطابقة حسابات العميل مع النموذج المالي</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500 sm:text-base sm:leading-8">لا يتم افتراض معنى الحساب من الاسم فقط. كل حساب يجب أن يرتبط بحساب نموذجي واضح قبل نشر البيانات إلى النموذج المالي.</p>
            </div>
            <div className="grid w-full gap-2 sm:flex sm:w-auto">
              <button type="button" onClick={autoMap} className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50">مطابقة تلقائية بالكود</button>
              <button type="button" onClick={() => setSaved(true)} disabled={mappedCount !== accounts.length} className="min-h-11 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">اعتماد المطابقة</button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-blue-900 sm:p-5">واجهة المطابقة الحالية هي طبقة مراجعة قبل الربط الفعلي بمصدر البيانات. لا يتم إنشاء Financial Facts من هذه المعاينة ولا يتم اعتبار أرقامها بيانات مالية فعلية.</div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><p className="text-xs text-slate-500">حسابات المصدر</p><p className="mt-2 text-2xl font-bold sm:text-3xl">{accounts.length}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><p className="text-xs text-slate-500">تمت مطابقتها</p><p className="mt-2 text-2xl font-bold sm:text-3xl">{mappedCount}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><p className="text-xs text-slate-500">تحتاج مراجعة</p><p className="mt-2 text-2xl font-bold text-amber-700 sm:text-3xl">{accounts.length - mappedCount}</p></div>
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
            <div><h3 className="font-bold text-slate-950">جدول المطابقة</h3><p className="mt-1 text-xs leading-6 text-slate-500 sm:text-sm">يمكن تغيير أي مطابقة يدويًا قبل اعتمادها.</p></div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث في الحسابات" className="input w-full md:max-w-xs" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3 font-semibold sm:px-6 sm:py-4">حساب المصدر</th><th className="px-4 py-3 font-semibold sm:px-6 sm:py-4">نوع الحساب</th><th className="px-4 py-3 font-semibold sm:px-6 sm:py-4">الحساب النموذجي</th><th className="px-4 py-3 font-semibold sm:px-6 sm:py-4">الحالة</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((account) => (
                  <tr key={account.sourceCode}>
                    <td className="px-4 py-4 sm:px-6 sm:py-5"><p className="font-bold text-slate-950">{account.sourceCode}</p><p className="mt-1 text-slate-500">{account.sourceName}</p></td>
                    <td className="px-4 py-4 text-slate-600 sm:px-6 sm:py-5">{account.type}</td>
                    <td className="px-4 py-4 sm:px-6 sm:py-5"><select value={account.mappedCode} onChange={(event) => setMapping(account.sourceCode, event.target.value)} className="input max-w-sm"><option value="">اختر الحساب النموذجي</option>{targetAccounts.map((target) => <option key={target.code} value={target.code}>{target.code} — {target.name}</option>)}</select></td>
                    <td className="px-4 py-4 sm:px-6 sm:py-5">{account.mappedCode ? <span className="whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">مطابق</span> : <span className="whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">مطلوب</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {saved && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-7 text-emerald-800 sm:p-5">اكتملت مراجعة المطابقة في الواجهة. الاعتماد الدائم والنشر المالي سيُفعّلان بعد ربط هذه الشاشة بمصدر الاستيراد الحقيقي.</div>}
      </section>
    </main>
  );
}
