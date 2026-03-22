'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { Download, DollarSign, ShoppingCart, Users, Percent } from 'lucide-react'
import { getMockServerPerformance, type ServerPerformanceEntry } from '@/lib/reports/mock-data'

function ServerTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3 shadow-warm-md">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm text-[var(--muted-foreground)]">
          {p.name}: <span className="font-medium" style={{ color: p.color }}>
            {p.name === 'Avg Tip %' ? `${p.value}%` : `$${p.value.toLocaleString()}`}
          </span>
        </p>
      ))}
    </div>
  )
}

export default function ServerPerformancePage() {
  const [data, setData] = useState<ServerPerformanceEntry[]>(getMockServerPerformance())
  const [isMock, setIsMock] = useState(true)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/server-performance?date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.ok) {
        const json = await res.json()
        setIsMock(json.is_mock)
        if (json.data) setData(json.data)
      }
    } catch {
      // Keep mock
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

  const chartData = data.map((s) => ({
    name: s.name.split(' ')[0],
    total_sales: s.total_sales,
    avg_check: s.avg_check,
  }))

  // Top performer
  const topServer = data.length > 0
    ? data.reduce((best, s) => (s.total_sales > best.total_sales ? s : best), data[0])
    : null

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Server Performance</h1>
          {isMock && (
            <p className="text-xs text-[var(--muted-foreground)] mt-1">Sample data</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <button
            type="button"
            onClick={() => window.open('/api/reports/export?type=server-performance', '_blank')}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium hover:bg-[var(--secondary)] transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full" />
        </div>
      )}

      {/* Server Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((server) => (
          <Card key={server.name} className={`shadow-warm-sm ${topServer?.name === server.name ? 'ring-2 ring-[var(--primary)]' : ''}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{server.name}</h3>
                {topServer?.name === server.name && (
                  <span className="text-xs font-medium bg-[var(--accent)] text-[var(--accent-foreground)] px-2 py-0.5 rounded-full">
                    Top Server
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)]">Sales</p>
                    <p className="text-sm font-bold tabular-nums">${server.total_sales.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)]">Orders</p>
                    <p className="text-sm font-bold tabular-nums">{server.orders}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)]">Avg Check</p>
                    <p className="text-sm font-bold tabular-nums">${server.avg_check.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Percent className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                  <div>
                    <p className="text-xs text-[var(--muted-foreground)]">Avg Tip</p>
                    <p className="text-sm font-bold tabular-nums text-[var(--success)]">{server.avg_tip_pct}%</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <p className="text-xs text-[var(--muted-foreground)]">Covers: <span className="font-medium text-[var(--foreground)]">{server.covers}</span></p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Chart */}
      <Card className="shadow-warm-sm">
        <CardHeader>
          <CardTitle className="text-base">Server Sales Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip content={<ServerTooltip />} />
                <Legend />
                <Bar yAxisId="left" dataKey="total_sales" name="Total Sales" fill="#F06B18" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="right" dataKey="avg_check" name="Avg Check" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="shadow-warm-sm">
        <CardHeader>
          <CardTitle className="text-base">Detailed Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-3 font-medium text-[var(--muted-foreground)]">Server</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Total Sales</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Orders</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Avg Check</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Avg Tip %</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Covers</th>
                </tr>
              </thead>
              <tbody>
                {data.map((server) => (
                  <tr key={server.name} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)]">
                    <td className="py-2 px-3 font-medium">{server.name}</td>
                    <td className="py-2 px-3 text-right tabular-nums">${server.total_sales.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{server.orders}</td>
                    <td className="py-2 px-3 text-right tabular-nums">${server.avg_check.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-[var(--success)]">{server.avg_tip_pct}%</td>
                    <td className="py-2 px-3 text-right tabular-nums">{server.covers}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--foreground)] font-bold">
                  <td className="py-2 px-3">Total</td>
                  <td className="py-2 px-3 text-right tabular-nums">${data.reduce((s, d) => s + d.total_sales, 0).toLocaleString()}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{data.reduce((s, d) => s + d.orders, 0)}</td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    ${data.length > 0 ? (data.reduce((s, d) => s + d.avg_check, 0) / data.length).toFixed(2) : '0.00'}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--success)]">
                    {data.length > 0 ? (data.reduce((s, d) => s + d.avg_tip_pct, 0) / data.length).toFixed(1) : '0.0'}%
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">{data.reduce((s, d) => s + d.covers, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
