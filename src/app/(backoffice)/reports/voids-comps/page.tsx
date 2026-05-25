'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui-v2/data/Table'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { EmployeeFlagBadge } from '@/components/reports/EmployeeFlagBadge'
import { Download, AlertTriangle } from 'lucide-react'

const VoidCompTrendChart = dynamic(
  () => import('@/components/reports/VoidCompTrendChart').then(m => ({ default: m.VoidCompTrendChart })),
  { ssr: false, loading: () => <Skeleton variant="chart" className="h-72" /> },
)
const VoidsByReasonPie = dynamic(() => import('@/components/reports/VoidsByReasonPie'), {
  ssr: false,
  loading: () => <Skeleton variant="chart" className="h-64" />,
})

interface VoidCompData {
  total_void: number
  total_comp: number
  total_discount: number
  by_employee: Array<{
    employee_name: string
    employee_id: string
    void_count: number
    void_total: number
    comp_count: number
    comp_total: number
    discount_count: number
    discount_total: number
    is_flagged: boolean
    void_rate: number
  }>
  by_reason: Array<{ reason: string; type: string; count: number; total: number }>
  by_day: Array<{ date: string; voids: number; comps: number; discounts: number }>
  location_avg_void_rate: number
}

// Pie-slice palette. Most slots map to semantic tokens; the violet slot
// (var(--color-purple-deep)) has no equivalent token and is the conventional 4th-series
// accent across the rest of the app.
const REASON_COLORS = [
  'var(--color-danger)',
  'var(--color-warning)',
  'var(--color-primary-active)',
  'var(--color-purple-deep)',
  'var(--color-success)',
  'var(--color-primary)',
  'var(--color-text-muted)',
]

export default function VoidsCompsPage() {
  const [data, setData] = useState<VoidCompData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true)
    setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/voids-comps?date_from=${dateFrom}&date_to=${dateTo}`)
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
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Voids, Comps & Discounts
          </h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">Patterns, totals, and employee flags</p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.open('/api/reports/export?type=voids-comps', '_blank')}
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
        <EmptyState
          icon={AlertTriangle}
          title="No void or comp data"
          description="Void and comp data will appear once items are voided or comped in orders."
        />
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--space-3)]">
            <Card padding="default" className="border-l-4 border-l-[color:var(--color-danger)]">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Total Voids</p>
              <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums text-[color:var(--color-danger)]">
                ${data.total_void.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </Card>
            <Card padding="default" className="border-l-4 border-l-[color:var(--color-warning)]">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Total Comps</p>
              <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums text-[color:var(--color-warning)]">
                ${data.total_comp.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </Card>
            <Card padding="default" className="border-l-4 border-l-[color:var(--color-primary)]">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Total Discounts</p>
              <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums text-[color:var(--color-primary)]">
                ${data.total_discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-3)]">
            <VoidCompTrendChart data={data.by_day} />
            <Card>
              <CardHeader>
                <CardTitle>By Reason</CardTitle>
              </CardHeader>
              <CardBody>
                <VoidsByReasonPie data={data.by_reason} colors={REASON_COLORS} />
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>By Employee</CardTitle>
            </CardHeader>
            <CardBody>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Employee</TableCell>
                    <TableCell header align="right">Voids</TableCell>
                    <TableCell header align="right">Void $</TableCell>
                    <TableCell header align="right">Comps</TableCell>
                    <TableCell header align="right">Comp $</TableCell>
                    <TableCell header align="right">Discounts</TableCell>
                    <TableCell header align="right">Disc $</TableCell>
                    <TableCell header align="right">Flag</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.by_employee.map(emp => (
                    <TableRow key={emp.employee_id} className={emp.is_flagged ? 'bg-[color:var(--color-danger-bg)]' : ''}>
                      <TableCell className="font-[var(--weight-medium)]">{emp.employee_name}</TableCell>
                      <TableCell align="right" className="tabular-nums">{emp.void_count}</TableCell>
                      <TableCell align="right" className="tabular-nums text-[color:var(--color-danger)]">${emp.void_total.toFixed(2)}</TableCell>
                      <TableCell align="right" className="tabular-nums">{emp.comp_count}</TableCell>
                      <TableCell align="right" className="tabular-nums text-[color:var(--color-warning)]">${emp.comp_total.toFixed(2)}</TableCell>
                      <TableCell align="right" className="tabular-nums">{emp.discount_count}</TableCell>
                      <TableCell align="right" className="tabular-nums text-[color:var(--color-primary)]">${emp.discount_total.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        <EmployeeFlagBadge rate={emp.void_rate} />
                      </TableCell>
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
