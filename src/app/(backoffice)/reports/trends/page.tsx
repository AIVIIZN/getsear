'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Select } from '@/components/ui-v2/inputs/Select'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui-v2/data/Table'
import { TrendLineChart } from '@/components/reports/TrendLineChart'
import { ComparisonArrow } from '@/components/reports/ComparisonArrow'
import { Download, LineChart } from 'lucide-react'

interface TrendWeek {
  week_start: string
  week_end: string
  week_number: number
  total_revenue: number
  avg_check: number
  order_count: number
  covers: number
  labor_pct: number
  food_cost_pct: number
  void_comp_pct: number
  is_deviation?: boolean
  deviation_pct?: number
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
] as const

export default function TrendsPage() {
  const [data, setData] = useState<TrendResponse | null>(null)
  const [metric, setMetric] = useState('total_revenue')
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (m: string) => {
    setLoading(true)
    setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/trends?metric=${m}`)
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
    fetchData(metric)
  }, [metric, fetchData])

  const metricConfig = METRICS.find(m => m.value === metric) ?? METRICS[0]
  const chartData = data?.weeks.map(w => ({
    week_start: w.week_start,
    week_number: w.week_number,
    value: (w as unknown as Record<string, number>)[metric] ?? 0,
    is_deviation: w.is_deviation ?? false,
    deviation_pct: w.deviation_pct ?? 0,
  })) ?? []

  return (
    <div className="p-[var(--space-6)] max-w-7xl mx-auto space-y-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">13-Week Trends</h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">Rolling averages for key performance metrics</p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="min-w-[160px]">
            <Select
              options={METRICS.map(m => ({ value: m.value, label: m.label }))}
              value={metric}
              onChange={setMetric}
              ariaLabel="Trend metric"
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.open('/api/reports/export?type=trends', '_blank')}
            leadingIcon={<Download className="h-4 w-4" />}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {loading && <Skeleton variant="chart" />}

      {isEmpty && !loading && (
        <EmptyState icon={LineChart} title="Not enough data for trends" description="Trend analysis requires at least 2 weeks of daily metrics data." />
      )}

      {!loading && data && chartData.length > 0 && (
        <>
          <TrendLineChart data={chartData} metricLabel={metricConfig.label} average={data.averages[metric] ?? 0} formatValue={metricConfig.format} />

          <Card>
            <CardHeader>
              <CardTitle>Weekly Breakdown</CardTitle>
            </CardHeader>
            <CardBody>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Week</TableCell>
                    <TableCell header align="right">{metricConfig.label}</TableCell>
                    <TableCell header align="right">vs Avg</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.weeks.map(week => {
                    const value = (week as unknown as Record<string, number>)[metric] ?? 0
                    return (
                      <TableRow key={week.week_number} className={week.is_deviation ? 'bg-[color:var(--color-warning-bg)]' : ''}>
                        <TableCell>
                          <span className="font-[var(--weight-medium)]">Week {week.week_number}</span>
                          <span className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] ml-[var(--space-2)]">
                            {new Date(week.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </TableCell>
                        <TableCell align="right" className="tabular-nums font-[var(--weight-medium)]">{metricConfig.format(value)}</TableCell>
                        <TableCell align="right">
                          {week.deviation_pct !== undefined && <ComparisonArrow value={week.deviation_pct} size="sm" invertColors={metric.includes('pct') && metric !== 'void_comp_pct'} />}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
