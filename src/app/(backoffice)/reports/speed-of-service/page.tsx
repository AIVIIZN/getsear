'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { SpeedHeatmap } from '@/components/reports/SpeedHeatmap'
import { Download, Timer } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatDuration } from '@/lib/reports/constants'

interface SpeedData {
  by_station: Array<{ station: string; avg_seconds: number; ticket_count: number }>
  by_daypart: Array<{ daypart: string; avg_seconds: number; ticket_count: number }>
  by_day: Array<{ date: string; avg_seconds: number; ticket_count: number }>
  heatmap: Array<{ station: string; daypart: string; avg_seconds: number; ticket_count: number }>
  outliers: Array<{ order_id: string; order_number: string; station: string; seconds: number; created_at: string }>
  overall_avg_seconds: number
}

export default function SpeedOfServicePage() {
  const [data, setData] = useState<SpeedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true)
    setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/speed-of-service?date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data) {
          setData(json.data)
        } else {
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
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 6)
    fetchData('this_week', weekAgo.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Speed of Service</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Kitchen ticket times by station and daypart</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <button
            type="button"
            onClick={() => window.open('/api/reports/export?type=speed-of-service', '_blank')}
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
            <div key={i} className="h-48 rounded-xl bg-[var(--secondary)] animate-pulse" />
          ))}
        </div>
      )}

      {isEmpty && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Timer className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
          <h3 className="text-lg font-medium mb-1">No speed data available</h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            KDS ticket events will appear once orders are processed through kitchen stations.
          </p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Station Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.by_station.map(station => (
              <Card key={station.station} className="shadow-warm-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-[var(--muted-foreground)] mb-1">{station.station}</p>
                  <p className="text-2xl font-bold tabular-nums">{formatDuration(station.avg_seconds)}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">{station.ticket_count} tickets</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Heatmap */}
          <SpeedHeatmap data={data.heatmap} overallAvg={data.overall_avg_seconds} />

          {/* Daily Trend */}
          <Card className="shadow-warm-sm">
            <CardHeader>
              <CardTitle className="text-base">Daily Average Ticket Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.by_day.map(d => ({ ...d, date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatDuration(v)} />
                    <Tooltip formatter={(v) => formatDuration(Number(v))} />
                    <Line type="monotone" dataKey="avg_seconds" name="Avg Time" stroke="#F06B18" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Outliers */}
          {data.outliers.length > 0 && (
            <Card className="shadow-warm-sm">
              <CardHeader>
                <CardTitle className="text-base">Outlier Tickets (&gt;2x Average)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-2 px-3 font-medium text-[var(--muted-foreground)]">Order</th>
                        <th className="text-left py-2 px-3 font-medium text-[var(--muted-foreground)]">Station</th>
                        <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Time</th>
                        <th className="text-right py-2 px-3 font-medium text-[var(--muted-foreground)]">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.outliers.map(ticket => (
                        <tr key={`${ticket.order_id}-${ticket.station}`} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)]">
                          <td className="py-2 px-3 font-medium">{ticket.order_number || ticket.order_id.slice(0, 8)}</td>
                          <td className="py-2 px-3">{ticket.station}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-[var(--error)] font-medium">{formatDuration(ticket.seconds)}</td>
                          <td className="py-2 px-3 text-right text-[var(--muted-foreground)]">{new Date(ticket.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
