'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui-v2/data/Table'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { SpeedHeatmap } from '@/components/reports/SpeedHeatmap'
import { Download, Timer } from 'lucide-react'
import { formatDuration } from '@/lib/reports/constants'

const SpeedTrendChart = dynamic(() => import('@/components/reports/SpeedTrendChart'), {
  ssr: false,
  loading: () => <Skeleton variant="chart" className="h-64" />,
})

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
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 6)
    fetchData('this_week', weekAgo.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  return (
    <div className="p-[var(--space-6)] max-w-7xl mx-auto space-y-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">Speed of Service</h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">Kitchen ticket times by station and daypart</p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.open('/api/reports/export?type=speed-of-service', '_blank')}
            leadingIcon={<Download className="h-4 w-4" />}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-[var(--space-3)]">
          {[1, 2, 3].map(i => <Skeleton key={i} variant="card" />)}
        </div>
      )}

      {isEmpty && !loading && (
        <EmptyState icon={Timer} title="No speed data available" description="KDS ticket events will appear once orders are processed through kitchen stations." />
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[var(--space-3)]">
            {data.by_station.map(station => (
              <Card key={station.station} padding="compact">
                <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">{station.station}</p>
                <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums">{formatDuration(station.avg_seconds)}</p>
                <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">{station.ticket_count} tickets</p>
              </Card>
            ))}
          </div>

          <SpeedHeatmap data={data.heatmap} overallAvg={data.overall_avg_seconds} />

          <Card>
            <CardHeader>
              <CardTitle>Daily Average Ticket Time</CardTitle>
            </CardHeader>
            <CardBody>
              <SpeedTrendChart data={data.by_day} />
            </CardBody>
          </Card>

          {data.outliers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Outlier Tickets (&gt;2x Average)</CardTitle>
              </CardHeader>
              <CardBody>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell header>Order</TableCell>
                      <TableCell header>Station</TableCell>
                      <TableCell header align="right">Time</TableCell>
                      <TableCell header align="right">Date</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.outliers.map(ticket => (
                      <TableRow key={`${ticket.order_id}-${ticket.station}`}>
                        <TableCell className="font-[var(--weight-medium)]">{ticket.order_number || ticket.order_id.slice(0, 8)}</TableCell>
                        <TableCell>{ticket.station}</TableCell>
                        <TableCell align="right" className="tabular-nums text-[color:var(--color-danger)] font-[var(--weight-medium)]">
                          {formatDuration(ticket.seconds)}
                        </TableCell>
                        <TableCell align="right" className="text-[color:var(--color-text-muted)]">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
