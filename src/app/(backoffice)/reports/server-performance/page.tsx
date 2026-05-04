'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Badge } from '@/components/ui-v2/data/Badge'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { Download, DollarSign, ShoppingCart, Users, Percent, UserCheck } from 'lucide-react'

const ServerComparisonChart = dynamic(() => import('@/components/reports/ServerComparisonChart'), {
  ssr: false,
  loading: () => <Skeleton variant="chart" className="h-72" />,
})

interface ServerEntry {
  name: string
  user_id: string
  total_sales: number
  orders: number
  avg_check: number
  avg_tip_pct: number
  covers: number
  cash_tips?: number
  card_tips?: number
}

export default function ServerPerformancePage() {
  const [data, setData] = useState<ServerEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true)
    setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/server-performance?date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data?.length) setData(json.data)
        else {
          setData([])
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

  const chartData = data.map(s => ({ name: s.name.split(' ')[0], total_sales: s.total_sales, avg_check: s.avg_check }))
  const topServer = data.length > 0 ? data.reduce((best, s) => (s.total_sales > best.total_sales ? s : best), data[0]) : null

  return (
    <div className="p-[var(--space-6)] max-w-7xl mx-auto space-y-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">Server Performance</h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">Sales, tips, and checks per server</p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.open('/api/reports/export?type=server-performance', '_blank')}
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
        <EmptyState icon={UserCheck} title="No server data" description="Server performance data appears after orders are assigned to servers." />
      )}

      {!loading && data.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--space-3)]">
            {data.map(server => (
              <Card key={server.user_id} className={topServer?.user_id === server.user_id ? 'ring-2 ring-[color:var(--color-primary)]' : ''}>
                <div className="flex items-center justify-between mb-[var(--space-3)]">
                  <h3 className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)]">{server.name}</h3>
                  {topServer?.user_id === server.user_id && (
                    <Badge variant="primary" shape="pill">Top Server</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-[var(--space-3)]">
                  <div className="flex items-center gap-[var(--space-2)]">
                    <DollarSign className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    <div>
                      <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">Sales</p>
                      <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-bold)] tabular-nums">${server.total_sales.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-[var(--space-2)]">
                    <ShoppingCart className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    <div>
                      <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">Orders</p>
                      <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-bold)] tabular-nums">{server.orders}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-[var(--space-2)]">
                    <Users className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    <div>
                      <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">Avg Check</p>
                      <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-bold)] tabular-nums">${server.avg_check.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-[var(--space-2)]">
                    <Percent className="h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
                    <div>
                      <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">Avg Tip</p>
                      <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-bold)] tabular-nums text-[color:var(--color-success)]">{server.avg_tip_pct}%</p>
                    </div>
                  </div>
                </div>
                <div className="mt-[var(--space-3)] pt-[var(--space-3)] border-t border-[color:var(--color-border)]">
                  <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
                    Covers: <span className="font-[var(--weight-medium)] text-[color:var(--color-text)]">{server.covers}</span>
                  </p>
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Server Sales Comparison</CardTitle>
            </CardHeader>
            <CardBody>
              <ServerComparisonChart data={chartData} />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
