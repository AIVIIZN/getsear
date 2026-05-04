'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui-v2/data/Table'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { Download, Salad, AlertTriangle } from 'lucide-react'

const FoodCostVarianceChart = dynamic(
  () => import('@/components/reports/FoodCostVarianceChart').then(m => ({ default: m.FoodCostVarianceChart })),
  { ssr: false, loading: () => <Skeleton variant="chart" className="h-72" /> },
)

interface FoodCostItem {
  name: string
  category: string
  qty_sold: number
  theoretical_cost: number
  actual_cost: number
  variance: number
  variance_pct: number
  is_flagged: boolean
}

interface FoodCostData {
  items: FoodCostItem[]
  total_theoretical: number
  total_revenue: number
  food_cost_pct: number
}

export default function FoodCostPage() {
  const [data, setData] = useState<FoodCostData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true)
    setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/food-cost?date_from=${dateFrom}&date_to=${dateTo}`)
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
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    fetchData('this_month', monthStart.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  const costColor = data
    ? data.food_cost_pct <= 28
      ? 'var(--color-success)'
      : data.food_cost_pct <= 35
        ? 'var(--color-warning)'
        : 'var(--color-danger)'
    : 'var(--color-text)'

  return (
    <div className="p-[var(--space-6)] max-w-7xl mx-auto space-y-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">Food Cost</h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">
            Theoretical vs actual food cost analysis
          </p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_month" />
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.open('/api/reports/export?type=food-cost', '_blank')}
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
        <EmptyState icon={Salad} title="No food cost data" description="Food cost data requires orders with menu items that have cost values configured." />
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--space-3)]">
            <Card padding="default">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Food Cost %</p>
              <p className="text-[length:var(--type-title-1-size)] font-[var(--weight-bold)] tabular-nums" style={{ color: costColor }}>
                {data.food_cost_pct.toFixed(1)}%
              </p>
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">Target: 28-35%</p>
            </Card>
            <Card padding="default">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Theoretical Cost</p>
              <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums">
                ${data.total_theoretical.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </Card>
            <Card padding="default">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Food Revenue</p>
              <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums">
                ${data.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </Card>
          </div>

          <FoodCostVarianceChart data={data.items} />

          <Card>
            <CardHeader>
              <CardTitle>Item Variance Detail</CardTitle>
            </CardHeader>
            <CardBody>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Item</TableCell>
                    <TableCell header>Category</TableCell>
                    <TableCell header align="right">Qty</TableCell>
                    <TableCell header align="right">Theoretical</TableCell>
                    <TableCell header align="right">Actual</TableCell>
                    <TableCell header align="right">Variance</TableCell>
                    <TableCell header align="right">Var %</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map(item => (
                    <TableRow key={item.name} className={item.is_flagged ? 'bg-[color:var(--color-danger-bg)]' : ''}>
                      <TableCell className="font-[var(--weight-medium)]">
                        <span className="flex items-center gap-[var(--space-1)]">
                          {item.is_flagged && <AlertTriangle className="h-3.5 w-3.5 text-[color:var(--color-danger)]" />}
                          {item.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-[color:var(--color-text-muted)]">{item.category}</TableCell>
                      <TableCell align="right" className="tabular-nums">{item.qty_sold}</TableCell>
                      <TableCell align="right" className="tabular-nums">${item.theoretical_cost.toFixed(2)}</TableCell>
                      <TableCell align="right" className="tabular-nums">${item.actual_cost.toFixed(2)}</TableCell>
                      <TableCell align="right" className="tabular-nums" style={{ color: item.variance > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {item.variance >= 0 ? '+' : ''}
                        {item.variance.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" className="tabular-nums font-[var(--weight-medium)]" style={{ color: item.is_flagged ? 'var(--color-danger)' : 'var(--color-text)' }}>
                        {item.variance_pct >= 0 ? '+' : ''}
                        {item.variance_pct.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
