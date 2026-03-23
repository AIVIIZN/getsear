'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { Download, Users } from 'lucide-react'

interface LaborEntry {
  name: string; role: string; hours: number; rate: number; total_pay: number; tips: number; overtime_hours: number; break_compliance?: boolean
}

interface LaborData {
  entries: LaborEntry[]; total_labor_cost: number; total_hours: number; labor_percentage: number; revenue: number; overtime_hours?: number; by_role?: Array<{ role: string; hours: number; cost: number; count: number }>
}

function LaborTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
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

export default function LaborReportPage() {
  const [data, setData] = useState<LaborData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true); setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/labor?date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data?.entries?.length > 0) setData(json.data)
        else { setData(null); setIsEmpty(true) }
      }
    } catch { setIsEmpty(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const now = new Date(); const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 6)
    fetchData('this_week', weekAgo.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  const chartData = data?.entries.filter(e => e.total_pay > 100).map(e => ({ name: e.name.split(' ')[0], labor_cost: e.total_pay, tips: e.tips })) ?? []
  const gaugeColor = data ? (data.labor_percentage <= 30 ? 'var(--success)' : data.labor_percentage <= 35 ? 'var(--warning)' : 'var(--error)') : 'var(--foreground)'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold">Labor Report</h1><p className="text-sm text-[var(--muted-foreground)] mt-1">Hours, cost, overtime, and break compliance</p></div>
        <div className="flex items-center gap-3">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <button type="button" onClick={() => window.open('/api/reports/export?type=labor', '_blank')} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium hover:bg-[var(--secondary)] transition-colors" style={{ height: 44 }}>
            <Download className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {loading && <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-[var(--secondary)] animate-pulse" />)}</div>}
      {isEmpty && !loading && <div className="flex flex-col items-center justify-center py-16 text-center"><Users className="h-12 w-12 text-[var(--muted-foreground)] mb-4" /><h3 className="text-lg font-medium mb-1">No labor data</h3><p className="text-sm text-[var(--muted-foreground)]">Labor data appears after staff clock in/out.</p></div>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="shadow-warm-sm"><CardContent className="p-5"><p className="text-xs text-[var(--muted-foreground)] mb-1">Total Labor Cost</p><p className="text-2xl font-bold tabular-nums">${data.total_labor_cost.toLocaleString()}</p></CardContent></Card>
            <Card className="shadow-warm-sm"><CardContent className="p-5"><p className="text-xs text-[var(--muted-foreground)] mb-1">Total Hours</p><p className="text-2xl font-bold tabular-nums">{data.total_hours.toFixed(1)}</p></CardContent></Card>
            <Card className="shadow-warm-sm"><CardContent className="p-5"><p className="text-xs text-[var(--muted-foreground)] mb-1">Revenue</p><p className="text-2xl font-bold tabular-nums">${data.revenue.toLocaleString()}</p></CardContent></Card>
            <Card className="shadow-warm-sm"><CardContent className="p-5">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Labor %</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: gaugeColor }}>{data.labor_percentage.toFixed(1)}%</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Target: 25-30%</p>
            </CardContent></Card>
          </div>

          <Card className="shadow-warm-sm"><CardHeader><CardTitle className="text-base">Labor Cost by Employee</CardTitle></CardHeader>
            <CardContent><div className="h-72"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip content={<LaborTooltip />} /><Legend />
                <Bar dataKey="labor_cost" name="Labor Cost" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="tips" name="Tips" fill="#16A34A" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer></div></CardContent>
          </Card>

          <Card className="shadow-warm-sm"><CardHeader><CardTitle className="text-base">Employee Breakdown</CardTitle></CardHeader>
            <CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--border)]">
              <th className="text-left py-2 px-3 font-medium text-[var(--muted-foreground)]">Name</th>
              <th className="text-left py-2 px-3 font-medium text-[var(--muted-foreground)]">Role</th>
              <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Hours</th>
              <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Rate</th>
              <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Total Pay</th>
              <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Tips</th>
              <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">OT</th>
              <th className="text-center py-2 px-3 font-medium text-[var(--muted-foreground)]">Break</th>
            </tr></thead><tbody>
              {data.entries.map(emp => (
                <tr key={emp.name} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)] even:bg-[var(--secondary)]/30">
                  <td className="py-2 px-3 font-medium">{emp.name}</td>
                  <td className="py-2 px-3 text-[var(--muted-foreground)]">{emp.role}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{emp.hours}</td>
                  <td className="py-2 px-3 text-right tabular-nums">${emp.rate.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right tabular-nums">${emp.total_pay.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-[var(--success)]">{emp.tips > 0 ? `$${emp.tips.toFixed(2)}` : '-'}</td>
                  <td className={`py-2 px-3 text-right tabular-nums ${emp.overtime_hours > 0 ? 'text-[var(--warning)] font-medium' : ''}`}>{emp.overtime_hours > 0 ? emp.overtime_hours : '-'}</td>
                  <td className="py-2 px-3 text-center">{emp.break_compliance === false ? <span className="text-xs text-[var(--error)] font-medium">Missing</span> : <span className="text-xs text-[var(--success)]">OK</span>}</td>
                </tr>
              ))}
            </tbody><tfoot><tr className="border-t-2 border-[var(--foreground)] font-bold">
              <td className="py-2 px-3" colSpan={2}>Total</td>
              <td className="py-2 px-3 text-right tabular-nums">{data.total_hours.toFixed(1)}</td>
              <td className="py-2 px-3 text-right tabular-nums">-</td>
              <td className="py-2 px-3 text-right tabular-nums">${data.total_labor_cost.toFixed(2)}</td>
              <td className="py-2 px-3 text-right tabular-nums text-[var(--success)]">${data.entries.reduce((s, e) => s + e.tips, 0).toFixed(2)}</td>
              <td className="py-2 px-3 text-right tabular-nums">{data.entries.reduce((s, e) => s + e.overtime_hours, 0)}</td>
              <td className="py-2 px-3"></td>
            </tr></tfoot></table></div></CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
