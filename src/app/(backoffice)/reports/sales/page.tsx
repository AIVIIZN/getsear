'use client'

import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'

interface DailySalesPoint {
  date: string
  gross_sales: number
  net_sales: number
  orders: number
  discounts: number
  tax: number
}

function SalesTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3 shadow-warm-md">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm text-[var(--muted-foreground)]">
          {p.name}: <span className="font-medium" style={{ color: p.color }}>${p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  )
}

export default function SalesReportPage() {
  const [data, setData] = useState<DailySalesPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true)
    setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/custom?date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          if (Array.isArray(json.data)) {
            setData(json.data)
          } else if (json.data.daily) {
            setData(json.data.daily.map((d: { metric_date: string; total_revenue: number; net_revenue: number; order_count: number; discount_total: number; tax_total: number }) => ({
              date: new Date(d.metric_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              gross_sales: Number(d.total_revenue) || 0,
              net_sales: Number(d.net_revenue) || 0,
              orders: Number(d.order_count) || 0,
              discounts: Number(d.discount_total) || 0,
              tax: Number(d.tax_total) || 0,
            })))
          }
          if (data.length === 0 && json.is_mock) setIsEmpty(true)
        } else {
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
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 6)
    fetchData('this_week', weekAgo.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  const totals = data.reduce(
    (acc, d) => ({ gross: acc.gross + d.gross_sales, net: acc.net + d.net_sales, orders: acc.orders + d.orders, discounts: acc.discounts + d.discounts, tax: acc.tax + d.tax }),
    { gross: 0, net: 0, orders: 0, discounts: 0, tax: 0 }
  )

  const mid = Math.floor(data.length / 2)
  const firstHalf = data.slice(0, mid).reduce((s, d) => s + d.gross_sales, 0)
  const secondHalf = data.slice(mid).reduce((s, d) => s + d.gross_sales, 0)
  const trend = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sales Report</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Revenue, orders, and trends</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <button type="button" onClick={() => window.open('/api/reports/export?type=daily', '_blank')} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium hover:bg-[var(--secondary)] transition-colors" style={{ height: 44 }}>
            <Download className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {loading && <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-[var(--secondary)] animate-pulse" />)}</div>}

      {!loading && data.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Gross Sales', value: `$${totals.gross.toLocaleString()}` },
              { label: 'Net Sales', value: `$${totals.net.toLocaleString()}` },
              { label: 'Orders', value: totals.orders.toLocaleString() },
              { label: 'Avg Check', value: `$${totals.orders > 0 ? (totals.gross / totals.orders).toFixed(2) : '0.00'}` },
              { label: 'Discounts', value: `$${totals.discounts.toLocaleString()}` },
              { label: 'Tax', value: `$${totals.tax.toLocaleString()}` },
            ].map((card) => (
              <Card key={card.label} className="shadow-warm-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-[var(--muted-foreground)] mb-1">{card.label}</p>
                  <p className="text-lg font-bold tabular-nums">{card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm">
            {trend >= 0 ? <TrendingUp className="h-4 w-4 text-[var(--success)]" /> : <TrendingDown className="h-4 w-4 text-[var(--error)]" />}
            <span className={trend >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%</span>
            <span className="text-[var(--muted-foreground)]">period-over-period trend</span>
          </div>

          <Card className="shadow-warm-sm">
            <CardHeader><CardTitle className="text-base">Daily Sales Trend</CardTitle></CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                    <Tooltip content={<SalesTooltip />} />
                    <Line type="monotone" dataKey="gross_sales" name="Gross Sales" stroke="#F06B18" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="net_sales" name="Net Sales" stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-warm-sm">
            <CardHeader><CardTitle className="text-base">Daily Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 font-medium text-[var(--muted-foreground)]">Date</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Orders</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Gross Sales</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Discounts</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Net Sales</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Tax</th>
                    <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Total</th>
                  </tr></thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={row.date} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)] even:bg-[var(--secondary)]/30">
                        <td className="py-2 px-3 font-medium">{row.date}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{row.orders}</td>
                        <td className="py-2 px-3 text-right tabular-nums">${row.gross_sales.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[var(--error)]">-${row.discounts.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right tabular-nums">${row.net_sales.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right tabular-nums">${row.tax.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium">${(row.net_sales + row.tax).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-[var(--foreground)] font-bold">
                    <td className="py-2 px-3">Total</td>
                    <td className="py-2 px-3 text-right tabular-nums">{totals.orders}</td>
                    <td className="py-2 px-3 text-right tabular-nums">${totals.gross.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-[var(--error)]">-${totals.discounts.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums">${totals.net.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums">${totals.tax.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums">${(totals.net + totals.tax).toLocaleString()}</td>
                  </tr></tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {isEmpty && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <TrendingUp className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
          <h3 className="text-lg font-medium mb-1">No sales data for this period</h3>
          <p className="text-sm text-[var(--muted-foreground)]">Sales data will appear after orders are processed. Try selecting a different date range.</p>
        </div>
      )}
    </div>
  )
}
