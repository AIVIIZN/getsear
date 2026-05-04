'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui-v2/Button'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { CashDrawerTable } from '@/components/reports/CashDrawerTable'
import { Download, Banknote } from 'lucide-react'
import type { CashToleranceLevel } from '@/lib/reports/constants'

interface CashDrawer {
  drawer_id: string
  employee_name: string
  employee_id: string
  opened_at: string
  closed_at: string | null
  starting_cash: number
  cash_sales: number
  cash_payouts: number
  expected_cash: number
  actual_cash: number
  over_short: number
  tolerance_level: CashToleranceLevel
}

interface CashSummary {
  total_starting: number
  total_cash_sales: number
  total_payouts: number
  total_expected: number
  total_actual: number
  total_over_short: number
  drawer_count: number
}

export default function CashReportPage() {
  const [drawers, setDrawers] = useState<CashDrawer[]>([])
  const [summary, setSummary] = useState<CashSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, _dateTo: string) => {
    setLoading(true)
    setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/cash?date=${dateFrom}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data?.drawers) {
          setDrawers(json.data.drawers)
          setSummary(json.data.summary)
          setIsEmpty(false)
        } else {
          setDrawers([])
          setSummary(null)
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
    const today = new Date().toISOString().split('T')[0]
    fetchData('today', today, today)
  }, [fetchData])

  return (
    <div className="p-[var(--space-6)] max-w-7xl mx-auto space-y-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">Cash Report</h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">
            Drawer reconciliation and over/short analysis
          </p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <DateRangePicker onRangeChange={fetchData} initialPreset="today" />
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.open('/api/reports/export?type=cash', '_blank')}
            leadingIcon={<Download className="h-4 w-4" />}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-[var(--space-3)]">
          {[1, 2, 3].map(i => <Skeleton key={i} variant="table-row" />)}
        </div>
      )}

      {isEmpty && !loading && (
        <EmptyState
          icon={Banknote}
          title="No cash drawer data"
          description="No cash drawers were opened or closed for this date. Try selecting a different date."
        />
      )}

      {!loading && drawers.length > 0 && summary && (
        <CashDrawerTable drawers={drawers} summary={summary} />
      )}
    </div>
  )
}
