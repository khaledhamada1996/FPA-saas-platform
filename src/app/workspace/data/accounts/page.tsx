"use client";

import { useMemo, useState } from "react";

type Account = {
  sourceCode: string;
  sourceName: string;
  type: string;
  mappedCode: string;
  mappedName: string;
};

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
    setAccounts((current) => current.map((account) => account.sourceCode === sourceCode
      ? { ...account, mappedCode: target?.code ?? "", mappedName: target?.name ?? "" }
      : account));
    setSaved(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-5 lg:px-10">
          <a href="/workspace" className="text-sm font-semibold text-slate-500 hover:text-slate-950">العودة لمساحة العمل</a>
          <div className="text-right"><p className="text-xs font-bold tracking-[0.14em] text-slate-400">ACCOUNT MAPPING</p><h1 className="mt-1 font-bold text-slate-950">شجرة الحسابات والمطابقة</h1></div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-6 py-10 lg:px-10">
        <div className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-8 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold text-slate-400">المرحلة الثانية</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">مطابقة حسابات العميل مع النموذج المالي</h2>
            <p className="mt-3 max-w-3xl leading-7 text-slate-500">لا يتم افتراض معنى الحساب من الاسم فقط. كل حساب يجب أن يرتبط بحساب نموذجي واضح قبل نشر البيانات إلى النموذج المالي.</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={autoMap} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50">مطابقة تلقائية بالكود</button>
            <button type="button" onClick={() => setSaved(true)} disabled={mappedCount !== accounts.length} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">اعتماد المطابقة</button>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-7 text-blue-900">واجهة المطابقة الحالية هي طبقة مراجعة قبل الربط الفعلي بمصدر البيانات. لا يتم إنشاء Financial Facts من هذه المعاينة ولا يتم اعتبار أرقامها بيانات مالية فعلية.</div>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">حسابات المصدر</p><p className="mt-2 text-3xl font-bold">{accounts.length}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">تمت مطابقتها</p><p className="mt-2 text-3xl font-bold">{mappedCount}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">تحتاج مراجعة</p><p className="mt-2 text-3xl font-bold text-amber-700">{accounts.length - mappedCount}</p></div>
        </div>

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-6 md:flex-row md:items-center md:justify-between">
            <div><h3 className="font-bold text-slate-950">جدول المطابقة</h3><p className="mt-1 text-sm text-slate-500">يمكن تغيير أي مطابقة يدويًا قبل اعتمادها.</p></div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث في الحسابات" className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-700" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-right text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-6 py-4 font-semibold">حساب المصدر</th><th className="px-6 py-4 font-semibold">نوع الحساب</th><th className="px-6 py-4 font-semibold">الحساب النموذجي</th><th className="px-6 py-4 font-semibold">الحالة</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((account) => (
                  <tr key={account.sourceCode}>
                    <td className="px-6 py-5"><p className="font-bold text-slate-950">{account.sourceCode}</p><p className="mt-1 text-slate-500">{account.sourceName}</p></td>
                    <td className="px-6 py-5 text-slate-600">{account.type}</td>
                    <td className="px-6 py-5">
                      <select value={account.mappedCode} onChange={(event) => setMapping(account.sourceCode, event.target.value)} className="w-full max-w-sm rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-700">
                        <option value="">اختر الحساب النموذجي</option>
                        {targetAccounts.map((target) => <option key={target.code} value={target.code}>{target.code} — {target.name}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-5">{account.mappedCode ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">مطابق</span> : <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">مطلوب</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {saved && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">اكتملت مراجعة المطابقة في الواجهة. الاعتماد الدائم والنشر المالي سيُفعّلان بعد ربط هذه الشاشة بمصدر الاستيراد الحقيقي.</div>}
      </section>
    </main>
  );
}
