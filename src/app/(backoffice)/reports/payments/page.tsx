'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { PaymentMixChart } from '@/components/reports/PaymentMixChart'
import { Download, CreditCard } from 'lucide-react'

interface PaymentEntry {
  method: string; amount: number; percentage: number; tip_total: number; refund_total: number; count: number; color: string
}

export default function PaymentsPage() {
  const [data, setData] = useState<PaymentEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true); setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/payments?date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.ok) { const json = await res.json(); if (json.data?.length) setData(json.data); else { setData([]); setIsEmpty(true) } }
    } catch { setIsEmpty(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const now = new Date(); const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 6)
    fetchData('this_week', weekAgo.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  const total = data.reduce((s, d) => s + d.amount, 0)
  const totalTips = data.reduce((s, d) => s + d.tip_total, 0)
  const totalRefunds = data.reduce((s, d) => s + d.refund_total, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Payment Summary</h1><p className="text-sm text-[var(--muted-foreground)] mt-1">Breakdown by method, tips, and refunds</p></div>
        <div className="flex items-center gap-3">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <button type="button" onClick={() => window.open('/api/reports/export?type=payments', '_blank')} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium hover:bg-[var(--secondary)] transition-colors" style={{ height: 44 }}><Download className="h-4 w-4" /> Export PDF</button>
        </div>
      </div>
      {loading && <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-32 rounded-xl bg-[var(--secondary)] animate-pulse" />)}</div>}
      {isEmpty && !loading && <div className="flex flex-col items-center justify-center py-16 text-center"><CreditCard className="h-12 w-12 text-[var(--muted-foreground)] mb-4" /><h3 className="text-lg font-medium mb-1">No payment data</h3><p className="text-sm text-[var(--muted-foreground)]">Payment data will appear once transactions are processed.</p></div>}
      {!loading && data.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-warm-sm"><CardContent className="p-5"><p className="text-xs text-[var(--muted-foreground)] mb-1">Total Payments</p><p className="text-2xl font-bold tabular-nums">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p></CardContent></Card>
            <Card className="shadow-warm-sm"><CardContent className="p-5"><p className="text-xs text-[var(--muted-foreground)] mb-1">Total Tips</p><p className="text-2xl font-bold tabular-nums text-[var(--success)]">${totalTips.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p></CardContent></Card>
            <Card className="shadow-warm-sm"><CardContent className="p-5"><p className="text-xs text-[var(--muted-foreground)] mb-1">Total Refunds</p><p className="text-2xl font-bold tabular-nums text-[var(--error)]">${totalRefunds.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p></CardContent></Card>
          </div>
          <PaymentMixChart data={data.map(d => ({ method: d.method, amount: d.amount, percentage: d.percentage, color: d.color }))} />
          <Card className="shadow-warm-sm"><CardHeader><CardTitle className="text-base">Payment Details</CardTitle></CardHeader><CardContent>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--border)]">
              <th className="text-left py-2 px-3 font-medium text-[var(--muted-foreground)]">Method</th>
              <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Count</th>
              <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Amount</th>
              <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">%</th>
              <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Tips</th>
              <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Refunds</th>
            </tr></thead><tbody>
              {data.map(d => <tr key={d.method} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)]">
                <td className="py-2 px-3"><span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />{d.method}</span></td>
                <td className="py-2 px-3 text-right tabular-nums">{d.count}</td>
                <td className="py-2 px-3 text-right tabular-nums font-medium">${d.amount.toFixed(2)}</td>
                <td className="py-2 px-3 text-right tabular-nums">{d.percentage}%</td>
                <td className="py-2 px-3 text-right tabular-nums text-[var(--success)]">${d.tip_total.toFixed(2)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-[var(--error)]">${d.refund_total.toFixed(2)}</td>
              </tr>)}
            </tbody></table></div>
          </CardContent></Card>
        </>
      )}
    </div>
  )
}
