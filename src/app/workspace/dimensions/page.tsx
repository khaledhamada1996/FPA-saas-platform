'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function DimensionsPage() {
  const [organizationId, setOrganizationId] = useState('')
  const [periods, setPeriods] = useState<any[]>([])
  const [periodId, setPeriodId] = useState('')
  const [dimension, setDimension] = useState<'branch' | 'cost_center'>('branch')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = sessionStorage.getItem('activeOrganizationId') || localStorage.getItem('activeOrganizationId') || ''
    setOrganizationId(id)
    if (!id) { setLoading(false); setError('لم يتم تحديد المؤسسة النشطة'); return }
    ;(async () => {
      const { data, error } = await getSupabaseBrowserClient().from('financial_periods').select('id,period_start,period_end,status').eq('organization_id', id).order('period_end', { ascending: false })
      if (error) setError(error.message)
      else { setPeriods(data || []); setPeriodId(data?.[0]?.id || '') }
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!organizationId || !periodId) return
    ;(async () => {
      setLoading(true); setError('')
      const { data, error } = await getSupabaseBrowserClient().rpc('get_dimension_analysis', { p_organization_id: organizationId, p_period_id: periodId, p_dimension: dimension })
      if (error) setError(error.message); else setRows(data?.rows || [])
      setLoading(false)
    })()
  }, [organizationId, periodId, dimension])

  const fmt = (n: number) => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format((n || 0) / 100)

  return <main dir="rtl" className="min-h-screen bg-slate-50 p-6 text-slate-900">
    <div className="mx-auto max-w-6xl space-y-6">
      <header><p className="text-sm font-medium text-slate-500">التحليل المالي</p><h1 className="mt-1 text-3xl font-bold">تحليل الفروع ومراكز التكلفة</h1><p className="mt-2 text-slate-600">مقارنة الأداء الفعلي المنشور حسب البعد الإداري</p></header>
      <section className="grid gap-4 rounded-2xl border bg-white p-5 md:grid-cols-2">
        <label className="text-sm font-medium">الفترة المالية<select className="mt-2 w-full rounded-xl border p-3" value={periodId} onChange={e=>setPeriodId(e.target.value)}>{periods.map(p=><option key={p.id} value={p.id}>{p.period_start} — {p.period_end}</option>)}</select></label>
        <label className="text-sm font-medium">البعد<select className="mt-2 w-full rounded-xl border p-3" value={dimension} onChange={e=>setDimension(e.target.value as any)}><option value="branch">الفروع</option><option value="cost_center">مراكز التكلفة</option></select></label>
      </section>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="border-b p-5"><h2 className="text-lg font-semibold">الأداء حسب {dimension === 'branch' ? 'الفرع' : 'مركز التكلفة'}</h2></div>
        {loading ? <div className="p-8 text-center text-slate-500">جارٍ التحميل...</div> : rows.length === 0 ? <div className="p-8 text-center text-slate-500">لا توجد بيانات فعلية منشورة لهذه الفترة</div> : <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead className="bg-slate-50"><tr><th className="p-4">البعد</th><th className="p-4">الإيرادات</th><th className="p-4">تكلفة المبيعات</th><th className="p-4">المصروفات التشغيلية</th><th className="p-4">الربح التشغيلي</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.dimension_id || `none-${i}`} className="border-t"><td className="p-4 font-medium">{r.dimension_name}</td><td className="p-4">{fmt(r.revenue)}</td><td className="p-4">{fmt(r.cogs)}</td><td className="p-4">{fmt(r.operating_expenses)}</td><td className="p-4 font-semibold">{fmt(r.revenue-r.cogs-r.operating_expenses)}</td></tr>)}</tbody></table></div>}
      </section>
      <p className="text-xs text-slate-500">المصدر: البيانات الفعلية المنشورة فقط. الحسابات حتمية ولا يستخدم الذكاء الاصطناعي كمصدر للأرقام.</p>
    </div>
  </main>
}
