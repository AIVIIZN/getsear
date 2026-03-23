'use client'

import { useState, useEffect, useCallback } from 'react'
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cash Report</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Drawer reconciliation and over/short analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker onRangeChange={fetchData} initialPreset="today" />
          <button
            type="button"
            onClick={() => window.open('/api/reports/export?type=cash', '_blank')}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium hover:bg-[var(--secondary)] transition-colors"
            style={{ height: 44 }}
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-[var(--secondary)] animate-pulse" />
          ))}
        </div>
      )}

      {isEmpty && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Banknote className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
          <h3 className="text-lg font-medium mb-1">No cash drawer data</h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            No cash drawers were opened or closed for this date. Try selecting a different date.
          </p>
        </div>
      )}

      {!loading && drawers.length > 0 && summary && (
        <CashDrawerTable drawers={drawers} summary={summary} />
      )}
    </div>
  )
}
