'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { FoodCostVarianceChart } from '@/components/reports/FoodCostVarianceChart'
import { Download, Salad, AlertTriangle } from 'lucide-react'

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
        else { setData(null); setIsEmpty(true) }
      }
    } catch { setIsEmpty(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    fetchData('this_month', monthStart.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  const costColor = data
    ? data.food_cost_pct <= 28 ? 'var(--success)' : data.food_cost_pct <= 35 ? 'var(--warning)' : 'var(--error)'
    : 'var(--foreground)'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Food Cost</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Theoretical vs actual food cost analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_month" />
          <button type="button" onClick={() => window.open('/api/reports/export?type=food-cost', '_blank')} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium hover:bg-[var(--secondary)] transition-colors" style={{ height: 44 }}>
            <Download className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {loading && <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-48 rounded-xl bg-[var(--secondary)] animate-pulse" />)}</div>}

      {isEmpty && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Salad className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
          <h3 className="text-lg font-medium mb-1">No food cost data</h3>
          <p className="text-sm text-[var(--muted-foreground)]">Food cost data requires orders with menu items that have cost values configured.</p>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-warm-sm"><CardContent className="p-5">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Food Cost %</p>
              <p className="text-3xl font-extrabold tabular-nums" style={{ color: costColor }}>{data.food_cost_pct.toFixed(1)}%</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Target: 28-35%</p>
            </CardContent></Card>
            <Card className="shadow-warm-sm"><CardContent className="p-5">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Theoretical Cost</p>
              <p className="text-2xl font-bold tabular-nums">${data.total_theoretical.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </CardContent></Card>
            <Card className="shadow-warm-sm"><CardContent className="p-5">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Food Revenue</p>
              <p className="text-2xl font-bold tabular-nums">${data.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </CardContent></Card>
          </div>

          <FoodCostVarianceChart data={data.items} />

          {/* Flagged items table */}
          <Card className="shadow-warm-sm">
            <CardContent className="p-5">
              <h3 className="text-base font-semibold mb-4">Item Variance Detail</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-3 font-medium text-[var(--muted-foreground)]">Item</th>
                      <th className="text-left py-2 px-3 font-medium text-[var(--muted-foreground)]">Category</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Qty</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Theoretical</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Actual</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Variance</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Var %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map(item => (
                      <tr key={item.name} className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)] ${item.is_flagged ? 'bg-red-50/50' : 'even:bg-[var(--secondary)]/30'}`}>
                        <td className="py-2 px-3 font-medium">
                          <span className="flex items-center gap-1.5">
                            {item.is_flagged && <AlertTriangle className="h-3.5 w-3.5 text-[var(--error)]" />}
                            {item.name}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[var(--muted-foreground)]">{item.category}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{item.qty_sold}</td>
                        <td className="py-2 px-3 text-right tabular-nums">${item.theoretical_cost.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">${item.actual_cost.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right tabular-nums" style={{ color: item.variance > 0 ? 'var(--error)' : 'var(--success)' }}>
                          {item.variance >= 0 ? '+' : ''}{item.variance.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium" style={{ color: item.is_flagged ? 'var(--error)' : 'var(--foreground)' }}>
                          {item.variance_pct >= 0 ? '+' : ''}{item.variance_pct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
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
