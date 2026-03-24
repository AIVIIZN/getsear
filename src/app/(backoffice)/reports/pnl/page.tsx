'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { PLWaterfallChart } from '@/components/reports/PLWaterfallChart'
import { ComparisonArrow } from '@/components/reports/ComparisonArrow'
import { Download, TrendingUp } from 'lucide-react'

interface PnLData {
  month: string; food_revenue: number; beverage_revenue: number; other_revenue: number
  total_revenue: number; refund_total: number; net_revenue: number
  cogs: number; cogs_pct: number; labor_cost: number; labor_pct: number
  gross_profit: number; gross_margin_pct: number
  prev_month: { total_revenue: number; cogs: number; labor_cost: number; gross_profit: number } | null
}

export default function PnLPage() {
  const [data, setData] = useState<PnLData | null>(null)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (m: string) => {
    setLoading(true); setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/pnl?month=${m}`)
      if (res.ok) { const json = await res.json(); if (json.data) setData(json.data); else { setData(null); setIsEmpty(true) } }
    } catch { setIsEmpty(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(month) }, [month, fetchData])

  const prevRevChange = data?.prev_month && data.prev_month.total_revenue > 0
    ? ((data.total_revenue - data.prev_month.total_revenue) / data.prev_month.total_revenue) * 100
    : 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">P&L Summary</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Monthly profit & loss from POS data</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 text-sm" style={{ height: 44 }} />
          <button type="button" onClick={() => window.open(`/api/reports/export?type=pnl&month=${month}`, '_blank')} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium hover:bg-[var(--secondary)] transition-colors" style={{ height: 44 }}>
            <Download className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {loading && <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-48 rounded-xl bg-[var(--secondary)] animate-pulse" />)}</div>}

      {isEmpty && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <TrendingUp className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
          <h3 className="text-lg font-medium mb-1">No P&L data available</h3>
          <p className="text-sm text-[var(--muted-foreground)]">P&L data requires completed orders and labor entries for the selected month.</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-warm-sm border-l-4 border-l-[#007AFF]"><CardContent className="p-5">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Revenue</p>
              <p className="text-2xl font-bold tabular-nums">${data.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              {prevRevChange !== 0 && <ComparisonArrow value={prevRevChange} size="sm" />}
            </CardContent></Card>
            <Card className="shadow-warm-sm border-l-4 border-l-[#DC2626]"><CardContent className="p-5">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">COGS</p>
              <p className="text-2xl font-bold tabular-nums">${data.cogs.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">{data.cogs_pct.toFixed(1)}% of revenue</p>
            </CardContent></Card>
            <Card className="shadow-warm-sm border-l-4 border-l-[#D97706]"><CardContent className="p-5">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Labor</p>
              <p className="text-2xl font-bold tabular-nums">${data.labor_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">{data.labor_pct.toFixed(1)}% of revenue</p>
            </CardContent></Card>
            <Card className="shadow-warm-sm border-l-4" style={{ borderLeftColor: data.gross_profit >= 0 ? '#16A34A' : '#DC2626' }}><CardContent className="p-5">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Gross Profit</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: data.gross_profit >= 0 ? '#16A34A' : '#DC2626' }}>
                ${data.gross_profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">{data.gross_margin_pct.toFixed(1)}% margin</p>
            </CardContent></Card>
          </div>

          <PLWaterfallChart revenue={data.total_revenue} cogs={data.cogs} labor={data.labor_cost} grossProfit={data.gross_profit} />

          {/* Revenue Breakdown */}
          <Card className="shadow-warm-sm">
            <CardContent className="p-5">
              <h3 className="text-base font-semibold mb-4">Revenue Breakdown</h3>
              <div className="space-y-3">
                {[
                  { label: 'Food Revenue', value: data.food_revenue },
                  { label: 'Beverage Revenue', value: data.beverage_revenue },
                  { label: 'Other Revenue', value: data.other_revenue },
                  { label: 'Refunds', value: -data.refund_total },
                ].filter(r => r.value !== 0).map(row => (
                  <div key={row.label} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-b-0">
                    <span className="text-sm">{row.label}</span>
                    <span className={`text-sm font-medium tabular-nums ${row.value < 0 ? 'text-[var(--error)]' : ''}`}>
                      {row.value < 0 ? '-' : ''}${Math.abs(row.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 font-bold">
                  <span className="text-sm">Net Revenue</span>
                  <span className="text-sm tabular-nums">${data.net_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
