'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { Download, Receipt } from 'lucide-react'

interface TaxEntry { rate_name: string; rate_pct: number; taxable_sales: number; tax_collected: number }

export default function TaxReportPage() {
  const [data, setData] = useState<TaxEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true); setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/tax?date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.ok) { const json = await res.json(); if (json.data?.length) setData(json.data); else { setData([]); setIsEmpty(true) } }
    } catch { setIsEmpty(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    fetchData('this_month', monthStart.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  const totalTax = data.reduce((s, d) => s + d.tax_collected, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Tax Report</h1><p className="text-sm text-[var(--muted-foreground)] mt-1">Tax collected by jurisdiction and rate</p></div>
        <div className="flex items-center gap-3">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_month" />
          <button type="button" onClick={() => window.open('/api/reports/export?type=tax', '_blank')} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium hover:bg-[var(--secondary)] transition-colors" style={{ height: 44 }}><Download className="h-4 w-4" /> Export PDF</button>
        </div>
      </div>
      {loading && <div className="h-48 rounded-xl bg-[var(--secondary)] animate-pulse" />}
      {isEmpty && !loading && <div className="flex flex-col items-center justify-center py-16 text-center"><Receipt className="h-12 w-12 text-[var(--muted-foreground)] mb-4" /><h3 className="text-lg font-medium mb-1">No tax data</h3><p className="text-sm text-[var(--muted-foreground)]">Tax data will populate after orders with tax are processed.</p></div>}
      {!loading && data.length > 0 && (
        <>
          <Card className="shadow-warm-sm"><CardContent className="p-5"><p className="text-xs text-[var(--muted-foreground)] mb-1">Total Tax Collected</p><p className="text-3xl font-extrabold tabular-nums">${totalTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p></CardContent></Card>
          <Card className="shadow-warm-sm"><CardHeader><CardTitle className="text-base">Tax Breakdown by Rate</CardTitle></CardHeader><CardContent>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--border)]">
              <th className="text-left py-3 px-3 font-medium text-[var(--muted-foreground)]">Tax Rate</th>
              <th className="text-right py-3 px-3 font-medium text-[var(--muted-foreground)]">Rate %</th>
              <th className="text-right py-3 px-3 font-medium text-[var(--muted-foreground)]">Taxable Sales</th>
              <th className="text-right py-3 px-3 font-medium text-[var(--muted-foreground)]">Tax Collected</th>
            </tr></thead><tbody>
              {data.map(row => <tr key={row.rate_name} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)] even:bg-[var(--secondary)]/30">
                <td className="py-3 px-3 font-medium">{row.rate_name}</td>
                <td className="py-3 px-3 text-right tabular-nums">{row.rate_pct.toFixed(2)}%</td>
                <td className="py-3 px-3 text-right tabular-nums">${row.taxable_sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="py-3 px-3 text-right tabular-nums font-medium">${row.tax_collected.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>)}
            </tbody><tfoot><tr className="border-t-2 border-[var(--foreground)] font-bold">
              <td className="py-3 px-3" colSpan={3}>Total</td>
              <td className="py-3 px-3 text-right tabular-nums">${totalTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr></tfoot></table></div>
          </CardContent></Card>
        </>
      )}
    </div>
  )
}
