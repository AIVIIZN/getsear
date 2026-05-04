'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui-v2/data/Table'
import { DateRangePicker, type DatePreset } from '@/components/reports/DateRangePicker'
import { Download, Receipt } from 'lucide-react'

interface TaxEntry {
  rate_name: string
  rate_pct: number
  taxable_sales: number
  tax_collected: number
}

export default function TaxReportPage() {
  const [data, setData] = useState<TaxEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)

  const fetchData = useCallback(async (_preset: DatePreset, dateFrom: string, dateTo: string) => {
    setLoading(true)
    setIsEmpty(false)
    try {
      const res = await fetch(`/api/reports/tax?date_from=${dateFrom}&date_to=${dateTo}`)
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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    fetchData('this_month', monthStart.toISOString().split('T')[0], now.toISOString().split('T')[0])
  }, [fetchData])

  const totalTax = data.reduce((s, d) => s + d.tax_collected, 0)

  return (
    <div className="p-[var(--space-6)] max-w-7xl mx-auto space-y-[var(--space-5)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">Tax Report</h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">Tax collected by jurisdiction and rate</p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <DateRangePicker onRangeChange={fetchData} initialPreset="this_month" />
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.open('/api/reports/export?type=tax', '_blank')}
            leadingIcon={<Download className="h-4 w-4" />}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {loading && <Skeleton variant="card" />}

      {isEmpty && !loading && (
        <EmptyState icon={Receipt} title="No tax data" description="Tax data will populate after orders with tax are processed." />
      )}

      {!loading && data.length > 0 && (
        <>
          <Card>
            <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)] mb-[var(--space-1)]">Total Tax Collected</p>
            <p className="text-[length:var(--type-title-1-size)] font-[var(--weight-bold)] tabular-nums">
              ${totalTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax Breakdown by Rate</CardTitle>
            </CardHeader>
            <CardBody>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Tax Rate</TableCell>
                    <TableCell header align="right">Rate %</TableCell>
                    <TableCell header align="right">Taxable Sales</TableCell>
                    <TableCell header align="right">Tax Collected</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(row => (
                    <TableRow key={row.rate_name}>
                      <TableCell className="font-[var(--weight-medium)]">{row.rate_name}</TableCell>
                      <TableCell align="right" className="tabular-nums">{row.rate_pct.toFixed(2)}%</TableCell>
                      <TableCell align="right" className="tabular-nums">${row.taxable_sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell align="right" className="tabular-nums font-[var(--weight-medium)]">${row.tax_collected.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-[color:var(--color-text)] font-[var(--weight-bold)]">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell align="right" className="tabular-nums">${totalTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</TableCell>
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
