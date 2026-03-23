'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { VoidCompTrendChart } from '@/components/reports/VoidCompTrendChart'
import { EmployeeFlagBadge } from '@/components/reports/EmployeeFlagBadge'
import { Download, AlertTriangle } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface VoidCompData {
  total_void: number
  total_comp: number
  total_discount: number
  by_employee: Array<{
    employee_name: string; employee_id: string
    void_count: number; void_total: number
    comp_count: number; comp_total: number
    discount_count: number; discount_total: number
    is_flagged: boolean; void_rate: number
  }>
  by_reason: Array<{ reason: string; type: string; count: number; total: number }>
  by_day: Array<{ date: string; voids: number; comps: number; discounts: number }>
  location_avg_void_rate: number
}

const REASON_COLORS = ['#DC2626', '#D97706', '#2563EB', '#7C3AED', '#16A34A', '#F06B18', '#6B7280']

export default function VoidsCompsPage() {
  const [data, setData] = useState<VoidCompData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true); setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/voids-comps?date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.ok) { const json = await res.json(); if (json.data) setData(json.data); else { setData(null); setIsEmpty(true) } }
    } catch { setIsEmpty(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const now = new Date(); const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 6)
    fetchData('this_week', weekAgo.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Voids, Comps & Discounts</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Patterns, totals, and employee flags</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <button type="button" onClick={() => window.open('/api/reports/export?type=voids-comps', '_blank')} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium hover:bg-[var(--secondary)] transition-colors" style={{ height: 44 }}>
            <Download className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {loading && <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-[var(--secondary)] animate-pulse" />)}</div>}

      {isEmpty && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
          <h3 className="text-lg font-medium mb-1">No void or comp data</h3>
          <p className="text-sm text-[var(--muted-foreground)]">Void and comp data will appear once items are voided or comped in orders.</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-warm-sm border-l-4 border-l-[#DC2626]"><CardContent className="p-5">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Total Voids</p>
              <p className="text-2xl font-bold tabular-nums text-[#DC2626]">${data.total_void.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </CardContent></Card>
            <Card className="shadow-warm-sm border-l-4 border-l-[#D97706]"><CardContent className="p-5">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Total Comps</p>
              <p className="text-2xl font-bold tabular-nums text-[#D97706]">${data.total_comp.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </CardContent></Card>
            <Card className="shadow-warm-sm border-l-4 border-l-[#2563EB]"><CardContent className="p-5">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Total Discounts</p>
              <p className="text-2xl font-bold tabular-nums text-[#2563EB]">${data.total_discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </CardContent></Card>
          </div>

          {/* Charts: Trend + Reason Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VoidCompTrendChart data={data.by_day} />
            <Card className="shadow-warm-sm">
              <CardContent className="p-5">
                <h3 className="text-base font-semibold mb-4">By Reason</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.by_reason} cx="50%" cy="50%" outerRadius={90} innerRadius={40} dataKey="total" nameKey="reason" strokeWidth={2} stroke="white">
                        {data.by_reason.map((_, i) => <Cell key={i} fill={REASON_COLORS[i % REASON_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                      <Legend formatter={(v: string) => <span className="text-xs">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Employee Table */}
          <Card className="shadow-warm-sm">
            <CardContent className="p-5">
              <h3 className="text-base font-semibold mb-4">By Employee</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-3 font-medium text-[var(--muted-foreground)]">Employee</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Voids</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Void $</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Comps</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Comp $</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Discounts</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Disc $</th>
                      <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_employee.map(emp => (
                      <tr key={emp.employee_id} className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)] ${emp.is_flagged ? 'bg-red-50/50' : ''}`}>
                        <td className="py-2 px-3 font-medium">{emp.employee_name}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{emp.void_count}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#DC2626]">${emp.void_total.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{emp.comp_count}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#D97706]">${emp.comp_total.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{emp.discount_count}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#2563EB]">${emp.discount_total.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right"><EmployeeFlagBadge rate={emp.void_rate} /></td>
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
