'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Text } from '@/components/ui-v2/inputs/Text'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { ComparisonArrow } from '@/components/reports/ComparisonArrow'
import { Download, TrendingUp } from 'lucide-react'

const PLWaterfallChart = dynamic(
  () => import('@/components/reports/PLWaterfallChart').then(m => ({ default: m.PLWaterfallChart })),
  { ssr: false, loading: () => <Skeleton variant="chart" className="h-72" /> },
)

interface PnLData {
  month: string
  food_revenue: number
  beverage_revenue: number
  other_revenue: number
  total_revenue: number
  refund_total: number
  net_revenue: number
  cogs: number
  cogs_pct: number
  labor_cost: number
  labor_pct: number
  gross_profit: number
  gross_margin_pct: number
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
    setLoading(true)
    setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/pnl?month=${m}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data) setData(json.data)
        else {
          setData(null)
          setIsEmpty(true)
        }
      }
    } catch {
      setIsEmpty(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(month)
  }, [month, fetchData])

  const prevRevChange =
    data?.prev_month && data.prev_month.total_revenue > 0
      ? ((data.total_revenue - data.prev_month.total_revenue) / data.prev_month.total_revenue) * 100
      : 0

  return (
    <div className="p-[var(--space-6)] max-w-7xl mx-auto space-y-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">P&L Summary</h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">Monthly profit & loss from POS data</p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <Text type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.open(`/api/reports/export?type=pnl&month=${month}`, '_blank')}
            leadingIcon={<Download className="h-4 w-4" />}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-[var(--space-3)]">
          {[1, 2].map(i => <Skeleton key={i} variant="card" />)}
        </div>
      )}

      {isEmpty && !loading && (
        <EmptyState icon={TrendingUp} title="No P&L data available" description="P&L data requires completed orders and labor entries for the selected month." />
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[var(--space-3)]">
            <Card padding="default" className="border-l-4 border-l-[color:var(--color-primary)]">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Revenue</p>
              <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums">${data.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              {prevRevChange !== 0 && <ComparisonArrow value={prevRevChange} size="sm" />}
            </Card>
            <Card padding="default" className="border-l-4 border-l-[color:var(--color-danger)]">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">COGS</p>
              <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums">${data.cogs.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">{data.cogs_pct.toFixed(1)}% of revenue</p>
            </Card>
            <Card padding="default" className="border-l-4 border-l-[color:var(--color-warning)]">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Labor</p>
              <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums">${data.labor_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">{data.labor_pct.toFixed(1)}% of revenue</p>
            </Card>
            <Card
              padding="default"
              className="border-l-4"
              style={{ borderLeftColor: data.gross_profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
            >
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Gross Profit</p>
              <p
                className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums"
                style={{ color: data.gross_profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
              >
                ${data.gross_profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">{data.gross_margin_pct.toFixed(1)}% margin</p>
            </Card>
          </div>

          <PLWaterfallChart revenue={data.total_revenue} cogs={data.cogs} labor={data.labor_cost} grossProfit={data.gross_profit} />

          <Card>
            <CardHeader>
              <CardTitle>Revenue Breakdown</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-[var(--space-3)]">
                {[
                  { label: 'Food Revenue', value: data.food_revenue },
                  { label: 'Beverage Revenue', value: data.beverage_revenue },
                  { label: 'Other Revenue', value: data.other_revenue },
                  { label: 'Refunds', value: -data.refund_total },
                ]
                  .filter(r => r.value !== 0)
                  .map(row => (
                    <div key={row.label} className="flex items-center justify-between py-[var(--space-2)] border-b border-[color:var(--color-border)] last:border-b-0">
                      <span className="text-[length:var(--type-subhead-size)]">{row.label}</span>
                      <span className={`text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] tabular-nums ${row.value < 0 ? 'text-[color:var(--color-danger)]' : ''}`}>
                        {row.value < 0 ? '-' : ''}${Math.abs(row.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                <div className="flex items-center justify-between py-[var(--space-2)] font-[var(--weight-bold)]">
                  <span className="text-[length:var(--type-subhead-size)]">Net Revenue</span>
                  <span className="text-[length:var(--type-subhead-size)] tabular-nums">${data.net_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
