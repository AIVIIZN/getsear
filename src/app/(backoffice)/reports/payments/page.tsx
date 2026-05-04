'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui-v2/data/Table'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { Download, CreditCard } from 'lucide-react'

const PaymentMixChart = dynamic(
  () => import('@/components/reports/PaymentMixChart').then(m => ({ default: m.PaymentMixChart })),
  { ssr: false, loading: () => <Skeleton variant="chart" className="h-72" /> },
)

interface PaymentEntry {
  method: string
  amount: number
  percentage: number
  tip_total: number
  refund_total: number
  count: number
  color: string
}

export default function PaymentsPage() {
  const [data, setData] = useState<PaymentEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true)
    setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/payments?date_from=${dateFrom}&date_to=${dateTo}`)
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

  const total = data.reduce((s, d) => s + d.amount, 0)
  const totalTips = data.reduce((s, d) => s + d.tip_total, 0)
  const totalRefunds = data.reduce((s, d) => s + d.refund_total, 0)

  return (
    <div className="p-[var(--space-6)] max-w-7xl mx-auto space-y-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">Payment Summary</h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">Breakdown by method, tips, and refunds</p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.open('/api/reports/export?type=payments', '_blank')}
            leadingIcon={<Download className="h-4 w-4" />}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-[var(--space-3)]">
          {[1, 2].map((i) => <Skeleton key={i} variant="card" />)}
        </div>
      )}

      {isEmpty && !loading && (
        <EmptyState icon={CreditCard} title="No payment data" description="Payment data will appear once transactions are processed." />
      )}

      {!loading && data.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--space-3)]">
            <Card padding="default">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Total Payments</p>
              <p className="text-[length:var(--type-title-3-size)] font-[var(--weight-bold)] tabular-nums">
                ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </Card>
            <Card padding="default">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Total Tips</p>
              <p className="text-[length:var(--type-title-3-size)] font-[var(--weight-bold)] tabular-nums text-[color:var(--color-success)]">
                ${totalTips.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </Card>
            <Card padding="default">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Total Refunds</p>
              <p className="text-[length:var(--type-title-3-size)] font-[var(--weight-bold)] tabular-nums text-[color:var(--color-danger)]">
                ${totalRefunds.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </Card>
          </div>

          <PaymentMixChart data={data.map(d => ({ method: d.method, amount: d.amount, percentage: d.percentage, color: d.color }))} />

          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardBody>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Method</TableCell>
                    <TableCell header align="right">Count</TableCell>
                    <TableCell header align="right">Amount</TableCell>
                    <TableCell header align="right">%</TableCell>
                    <TableCell header align="right">Tips</TableCell>
                    <TableCell header align="right">Refunds</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(d => (
                    <TableRow key={d.method}>
                      <TableCell>
                        <span className="flex items-center gap-[var(--space-2)]">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                          {d.method}
                        </span>
                      </TableCell>
                      <TableCell align="right" className="tabular-nums">{d.count}</TableCell>
                      <TableCell align="right" className="tabular-nums font-[var(--weight-medium)]">${d.amount.toFixed(2)}</TableCell>
                      <TableCell align="right" className="tabular-nums">{d.percentage}%</TableCell>
                      <TableCell align="right" className="tabular-nums text-[color:var(--color-success)]">${d.tip_total.toFixed(2)}</TableCell>
                      <TableCell align="right" className="tabular-nums text-[color:var(--color-danger)]">${d.refund_total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
