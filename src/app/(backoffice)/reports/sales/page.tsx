'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui-v2/data/Table'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'

const SalesTrendChart = dynamic(() => import('@/components/reports/SalesTrendChart'), {
  ssr: false,
  loading: () => <Skeleton variant="chart" className="h-72" />,
})

interface DailySalesPoint {
  date: string
  gross_sales: number
  net_sales: number
  orders: number
  discounts: number
  tax: number
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
            setData(
              json.data.daily.map(
                (d: {
                  metric_date: string
                  total_revenue: number
                  net_revenue: number
                  order_count: number
                  discount_total: number
                  tax_total: number
                }) => ({
                  date: new Date(d.metric_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  gross_sales: Number(d.total_revenue) || 0,
                  net_sales: Number(d.net_revenue) || 0,
                  orders: Number(d.order_count) || 0,
                  discounts: Number(d.discount_total) || 0,
                  tax: Number(d.tax_total) || 0,
                }),
              ),
            )
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 6)
    fetchData('this_week', weekAgo.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  const totals = data.reduce(
    (acc, d) => ({
      gross: acc.gross + d.gross_sales,
      net: acc.net + d.net_sales,
      orders: acc.orders + d.orders,
      discounts: acc.discounts + d.discounts,
      tax: acc.tax + d.tax,
    }),
    { gross: 0, net: 0, orders: 0, discounts: 0, tax: 0 },
  )

  const mid = Math.floor(data.length / 2)
  const firstHalf = data.slice(0, mid).reduce((s, d) => s + d.gross_sales, 0)
  const secondHalf = data.slice(mid).reduce((s, d) => s + d.gross_sales, 0)
  const trend = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0

  return (
    <div className="p-[var(--space-6)] max-w-7xl mx-auto space-y-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">Sales Report</h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">
            Revenue, orders, and trends
          </p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.open('/api/reports/export?type=daily', '_blank')}
            leadingIcon={<Download className="h-4 w-4" />}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-[var(--space-3)]">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      )}

      {!loading && data.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[var(--space-3)]">
            {[
              { label: 'Gross Sales', value: `$${totals.gross.toLocaleString()}` },
              { label: 'Net Sales', value: `$${totals.net.toLocaleString()}` },
              { label: 'Orders', value: totals.orders.toLocaleString() },
              {
                label: 'Avg Check',
                value: `$${totals.orders > 0 ? (totals.gross / totals.orders).toFixed(2) : '0.00'}`,
              },
              { label: 'Discounts', value: `$${totals.discounts.toLocaleString()}` },
              { label: 'Tax', value: `$${totals.tax.toLocaleString()}` },
            ].map((card) => (
              <Card key={card.label} padding="compact">
                <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">{card.label}</p>
                <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums">{card.value}</p>
              </Card>
            ))}
          </div>

          <div className="flex items-center gap-[var(--space-2)] text-[length:var(--type-subhead-size)]">
            {trend >= 0 ? (
              <TrendingUp className="h-4 w-4 text-[color:var(--color-success)]" />
            ) : (
              <TrendingDown className="h-4 w-4 text-[color:var(--color-danger)]" />
            )}
            <span className={trend >= 0 ? 'text-[color:var(--color-success)]' : 'text-[color:var(--color-danger)]'}>
              {trend >= 0 ? '+' : ''}
              {trend.toFixed(1)}%
            </span>
            <span className="text-[color:var(--color-text-muted)]">period-over-period trend</span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Daily Sales Trend</CardTitle>
            </CardHeader>
            <CardBody>
              <SalesTrendChart data={data} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Breakdown</CardTitle>
            </CardHeader>
            <CardBody>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Date</TableCell>
                    <TableCell header align="right">Orders</TableCell>
                    <TableCell header align="right">Gross Sales</TableCell>
                    <TableCell header align="right">Discounts</TableCell>
                    <TableCell header align="right">Net Sales</TableCell>
                    <TableCell header align="right">Tax</TableCell>
                    <TableCell header align="right">Total</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell className="font-[var(--weight-medium)]">{row.date}</TableCell>
                      <TableCell align="right" className="tabular-nums">{row.orders}</TableCell>
                      <TableCell align="right" className="tabular-nums">${row.gross_sales.toLocaleString()}</TableCell>
                      <TableCell align="right" className="tabular-nums text-[color:var(--color-danger)]">
                        -${row.discounts.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" className="tabular-nums">${row.net_sales.toLocaleString()}</TableCell>
                      <TableCell align="right" className="tabular-nums">${row.tax.toLocaleString()}</TableCell>
                      <TableCell align="right" className="tabular-nums font-[var(--weight-medium)]">
                        ${(row.net_sales + row.tax).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-[color:var(--color-text)] font-[var(--weight-bold)]">
                    <TableCell>Total</TableCell>
                    <TableCell align="right" className="tabular-nums">{totals.orders}</TableCell>
                    <TableCell align="right" className="tabular-nums">${totals.gross.toLocaleString()}</TableCell>
                    <TableCell align="right" className="tabular-nums text-[color:var(--color-danger)]">
                      -${totals.discounts.toLocaleString()}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">${totals.net.toLocaleString()}</TableCell>
                    <TableCell align="right" className="tabular-nums">${totals.tax.toLocaleString()}</TableCell>
                    <TableCell align="right" className="tabular-nums">
                      ${(totals.net + totals.tax).toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </>
      )}

      {isEmpty && !loading && (
        <EmptyState
          illustration="no-reports"
          title="No sales data for this period"
          description="Sales data will appear after orders are processed. Try selecting a different date range."
        />
      )}
    </div>
  )
}
