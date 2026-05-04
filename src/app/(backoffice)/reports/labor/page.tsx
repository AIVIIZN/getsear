'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui-v2/data/Table'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { Download, Users } from 'lucide-react'

const LaborByEmployeeChart = dynamic(() => import('@/components/reports/LaborByEmployeeChart'), {
  ssr: false,
  loading: () => <Skeleton variant="chart" className="h-72" />,
})

interface LaborEntry {
  name: string
  role: string
  hours: number
  rate: number
  total_pay: number
  tips: number
  overtime_hours: number
  break_compliance?: boolean
}

interface LaborData {
  entries: LaborEntry[]
  total_labor_cost: number
  total_hours: number
  labor_percentage: number
  revenue: number
  overtime_hours?: number
  by_role?: Array<{ role: string; hours: number; cost: number; count: number }>
}

export default function LaborReportPage() {
  const [data, setData] = useState<LaborData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true)
    setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/labor?date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data?.entries?.length > 0) setData(json.data)
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

  const chartData =
    data?.entries
      .filter(e => e.total_pay > 100)
      .map(e => ({ name: e.name.split(' ')[0], labor_cost: e.total_pay, tips: e.tips })) ?? []
  const gaugeColor = data
    ? data.labor_percentage <= 30
      ? 'var(--color-success)'
      : data.labor_percentage <= 35
        ? 'var(--color-warning)'
        : 'var(--color-danger)'
    : 'var(--color-text)'

  return (
    <div className="p-[var(--space-6)] max-w-7xl mx-auto space-y-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">Labor Report</h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">Hours, cost, overtime, and break compliance</p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_week" />
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.open('/api/reports/export?type=labor', '_blank')}
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
        <EmptyState icon={Users} title="No labor data" description="Labor data appears after staff clock in/out." />
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-[var(--space-3)]">
            <Card padding="default">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Total Labor Cost</p>
              <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums">${data.total_labor_cost.toLocaleString()}</p>
            </Card>
            <Card padding="default">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Total Hours</p>
              <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums">{data.total_hours.toFixed(1)}</p>
            </Card>
            <Card padding="default">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Revenue</p>
              <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums">${data.revenue.toLocaleString()}</p>
            </Card>
            <Card padding="default">
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Labor %</p>
              <p className="text-[length:var(--type-headline-size)] font-[var(--weight-bold)] tabular-nums" style={{ color: gaugeColor }}>
                {data.labor_percentage.toFixed(1)}%
              </p>
              <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">Target: 25-30%</p>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Labor Cost by Employee</CardTitle>
            </CardHeader>
            <CardBody>
              <LaborByEmployeeChart data={chartData} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employee Breakdown</CardTitle>
            </CardHeader>
            <CardBody>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Name</TableCell>
                    <TableCell header>Role</TableCell>
                    <TableCell header align="right">Hours</TableCell>
                    <TableCell header align="right">Rate</TableCell>
                    <TableCell header align="right">Total Pay</TableCell>
                    <TableCell header align="right">Tips</TableCell>
                    <TableCell header align="right">OT</TableCell>
                    <TableCell header align="center">Break</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map(emp => (
                    <TableRow key={emp.name}>
                      <TableCell className="font-[var(--weight-medium)]">{emp.name}</TableCell>
                      <TableCell className="text-[color:var(--color-text-muted)]">{emp.role}</TableCell>
                      <TableCell align="right" className="tabular-nums">{emp.hours}</TableCell>
                      <TableCell align="right" className="tabular-nums">${emp.rate.toFixed(2)}</TableCell>
                      <TableCell align="right" className="tabular-nums">${emp.total_pay.toFixed(2)}</TableCell>
                      <TableCell align="right" className="tabular-nums text-[color:var(--color-success)]">
                        {emp.tips > 0 ? `$${emp.tips.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell align="right" className={`tabular-nums ${emp.overtime_hours > 0 ? 'text-[color:var(--color-warning)] font-[var(--weight-medium)]' : ''}`}>
                        {emp.overtime_hours > 0 ? emp.overtime_hours : '-'}
                      </TableCell>
                      <TableCell align="center">
                        {emp.break_compliance === false ? (
                          <span className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-danger)] font-[var(--weight-medium)]">Missing</span>
                        ) : (
                          <span className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-success)]">OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-[color:var(--color-text)] font-[var(--weight-bold)]">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell align="right" className="tabular-nums">{data.total_hours.toFixed(1)}</TableCell>
                    <TableCell align="right" className="tabular-nums">-</TableCell>
                    <TableCell align="right" className="tabular-nums">${data.total_labor_cost.toFixed(2)}</TableCell>
                    <TableCell align="right" className="tabular-nums text-[color:var(--color-success)]">
                      ${data.entries.reduce((s, e) => s + e.tips, 0).toFixed(2)}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {data.entries.reduce((s, e) => s + e.overtime_hours, 0)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
