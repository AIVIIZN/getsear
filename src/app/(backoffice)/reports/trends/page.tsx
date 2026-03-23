'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendLineChart } from '@/components/reports/TrendLineChart'
import { ComparisonArrow } from '@/components/reports/ComparisonArrow'
import { Download, LineChart } from 'lucide-react'

interface TrendWeek {
  week_start: string; week_end: string; week_number: number
  total_revenue: number; avg_check: number; order_count: number; covers: number
  labor_pct: number; food_cost_pct: number; void_comp_pct: number
  is_deviation?: boolean; deviation_pct?: number
}

interface TrendResponse {
  weeks: TrendWeek[]
  averages: Record<string, number>
  selected_metric: string
}

const METRICS = [
  { value: 'total_revenue', label: 'Revenue', format: (v: number) => `$${(v / 1000).toFixed(1)}k` },
  { value: 'avg_check', label: 'Avg Check', format: (v: number) => `$${v.toFixed(2)}` },
  { value: 'order_count', label: 'Orders', format: (v: number) => v.toLocaleString() },
  { value: 'covers', label: 'Covers', format: (v: number) => v.toLocaleString() },
  { value: 'labor_pct', label: 'Labor %', format: (v: number) => `${v.toFixed(1)}%` },
  { value: 'food_cost_pct', label: 'Food Cost %', format: (v: number) => `${v.toFixed(1)}%` },
  { value: 'void_comp_pct', label: 'Void/Comp %', format: (v: number) => `${v.toFixed(1)}%` },
]

export default function TrendsPage() {
  const [data, setData] = useState<TrendResponse | null>(null)
  const [metric, setMetric] = useState('total_revenue')
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (m: string) => {
    setLoading(true); setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/trends?metric=${m}`)
      if (res.ok) { const json = await res.json(); if (json.data) setData(json.data); else { setData(null); setIsEmpty(true) } }
    } catch { setIsEmpty(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(metric) }, [metric, fetchData])

  const metricConfig = METRICS.find(m => m.value === metric) ?? METRICS[0]
  const chartData = data?.weeks.map(w => ({
    week_start: w.week_start,
    week_number: w.week_number,
    value: (w as unknown as Record<string, number>)[metric] ?? 0,
    is_deviation: w.is_deviation ?? false,
    deviation_pct: w.deviation_pct ?? 0,
  })) ?? []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">13-Week Trends</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Rolling averages for key performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={metric} onChange={e => setMetric(e.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium" style={{ height: 44 }}>
            {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button type="button" onClick={() => window.open('/api/reports/export?type=trends', '_blank')} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium hover:bg-[var(--secondary)] transition-colors" style={{ height: 44 }}>
            <Download className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {loading && <div className="h-96 rounded-xl bg-[var(--secondary)] animate-pulse" />}

      {isEmpty && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <LineChart className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
          <h3 className="text-lg font-medium mb-1">Not enough data for trends</h3>
          <p className="text-sm text-[var(--muted-foreground)]">Trend analysis requires at least 2 weeks of daily metrics data.</p>
        </div>
      )}

      {!loading && data && chartData.length > 0 && (
        <>
          <TrendLineChart data={chartData} metricLabel={metricConfig.label} average={data.averages[metric] ?? 0} formatValue={metricConfig.format} />

          {/* Week-by-week table */}
          <Card className="shadow-warm-sm">
            <CardContent className="p-5">
              <h3 className="text-base font-semibold mb-4">Weekly Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-3 font-medium text-[var(--muted-foreground)]">Week</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">{metricConfig.label}</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">vs Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weeks.map(week => {
                      const value = (week as unknown as Record<string, number>)[metric] ?? 0
                      return (
                        <tr key={week.week_number} className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)] ${week.is_deviation ? 'bg-orange-50/50' : ''}`}>
                          <td className="py-2 px-3">
                            <span className="font-medium">Week {week.week_number}</span>
                            <span className="text-xs text-[var(--muted-foreground)] ml-2">
                              {new Date(week.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium">{metricConfig.format(value)}</td>
                          <td className="py-2 px-3 text-right">
                            {week.deviation_pct !== undefined && <ComparisonArrow value={week.deviation_pct} size="sm" invertColors={metric.includes('pct') && metric !== 'void_comp_pct'} />}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
