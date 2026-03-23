'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { Download, DollarSign, ShoppingCart, Users, Percent, UserCheck } from 'lucide-react'

interface ServerEntry { name: string; user_id: string; total_sales: number; orders: number; avg_check: number; avg_tip_pct: number; covers: number; cash_tips?: number; card_tips?: number }

function ServerTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3 shadow-warm-md">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map(p => <p key={p.name} className="text-sm text-[var(--muted-foreground)]">{p.name}: <span className="font-medium" style={{ color: p.color }}>{p.name === 'Avg Tip %' ? `${p.value}%` : `$${p.value.toLocaleString()}`}</span></p>)}
    </div>
  )
}

export default function ServerPerformancePage() {
  const [data, setData] = useState<ServerEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true); setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/server-performance?date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.ok) { const json = await res.json(); if (json.data?.length) setData(json.data); else { setData([]); setIsEmpty(true) } }
    } catch { setIsEmpty(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const now = new Date(); const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 6)
    fetchData('this_week', weekAgo.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  const chartData = data.map(s => ({ name: s.name.split(' ')[0], total_sales: s.total_sales, avg_check: s.avg_check }))
  const topServer = data.length > 0 ? data.reduce((best, s) => s.total_sales > best.total_sales ? s : best, data[0]) : null

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Server Performance</h1><p className="text-sm text-[var(--muted-foreground)] mt-1">Sales, tips, and checks per server</p></div>
        <div className="flex items-center gap-3">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <button type="button" onClick={() => window.open('/api/reports/export?type=server-performance', '_blank')} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium hover:bg-[var(--secondary)] transition-colors" style={{ height: 44 }}><Download className="h-4 w-4" /> Export PDF</button>
        </div>
      </div>
      {loading && <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-[var(--secondary)] animate-pulse" />)}</div>}
      {isEmpty && !loading && <div className="flex flex-col items-center justify-center py-16 text-center"><UserCheck className="h-12 w-12 text-[var(--muted-foreground)] mb-4" /><h3 className="text-lg font-medium mb-1">No server data</h3><p className="text-sm text-[var(--muted-foreground)]">Server performance data appears after orders are assigned to servers.</p></div>}
      {!loading && data.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map(server => (
              <Card key={server.user_id} className={`shadow-warm-sm ${topServer?.user_id === server.user_id ? 'ring-2 ring-[var(--primary)]' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{server.name}</h3>
                    {topServer?.user_id === server.user_id && <span className="text-xs font-medium bg-[var(--accent)] text-[var(--accent-foreground)] px-2 py-0.5 rounded-full">Top Server</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2"><DollarSign className="h-3.5 w-3.5 text-[var(--muted-foreground)]" /><div><p className="text-xs text-[var(--muted-foreground)]">Sales</p><p className="text-sm font-bold tabular-nums">${server.total_sales.toLocaleString()}</p></div></div>
                    <div className="flex items-center gap-2"><ShoppingCart className="h-3.5 w-3.5 text-[var(--muted-foreground)]" /><div><p className="text-xs text-[var(--muted-foreground)]">Orders</p><p className="text-sm font-bold tabular-nums">{server.orders}</p></div></div>
                    <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-[var(--muted-foreground)]" /><div><p className="text-xs text-[var(--muted-foreground)]">Avg Check</p><p className="text-sm font-bold tabular-nums">${server.avg_check.toFixed(2)}</p></div></div>
                    <div className="flex items-center gap-2"><Percent className="h-3.5 w-3.5 text-[var(--muted-foreground)]" /><div><p className="text-xs text-[var(--muted-foreground)]">Avg Tip</p><p className="text-sm font-bold tabular-nums text-[var(--success)]">{server.avg_tip_pct}%</p></div></div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[var(--border)]">
                    <p className="text-xs text-[var(--muted-foreground)]">Covers: <span className="font-medium text-[var(--foreground)]">{server.covers}</span></p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-warm-sm"><CardHeader><CardTitle className="text-base">Server Sales Comparison</CardTitle></CardHeader>
            <CardContent><div className="h-72"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip content={<ServerTooltip />} /><Legend />
                <Bar yAxisId="left" dataKey="total_sales" name="Total Sales" fill="#F06B18" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="right" dataKey="avg_check" name="Avg Check" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer></div></CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
