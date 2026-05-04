'use client'

import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui-v2/Card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui-v2/data/Table'
import { TOLERANCE_COLORS, type CashToleranceLevel } from '@/lib/reports/constants'

interface CashDrawerRow {
  drawer_id: string
  employee_name: string
  opened_at: string
  closed_at: string | null
  starting_cash: number
  cash_sales: number
  cash_payouts: number
  expected_cash: number
  actual_cash: number
  over_short: number
  tolerance_level: CashToleranceLevel
}

interface CashDrawerTableProps {
  drawers: CashDrawerRow[]
  summary: {
    total_starting: number
    total_cash_sales: number
    total_payouts: number
    total_expected: number
    total_actual: number
    total_over_short: number
    drawer_count: number
  }
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function summaryToleranceColor(value: number): string {
  const abs = Math.abs(value)
  if (abs <= 5) return 'var(--color-success)'
  if (abs <= 20) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

export function CashDrawerTable({ drawers, summary }: CashDrawerTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Drawer Reconciliation</CardTitle>
      </CardHeader>
      <CardBody>
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell header>Employee</TableCell>
              <TableCell header>Shift</TableCell>
              <TableCell header align="right">Opening</TableCell>
              <TableCell header align="right">Cash Sales</TableCell>
              <TableCell header align="right">Payouts</TableCell>
              <TableCell header align="right">Expected</TableCell>
              <TableCell header align="right">Actual</TableCell>
              <TableCell header align="right">Over/Short</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drawers.map((drawer) => (
              <TableRow key={drawer.drawer_id}>
                <TableCell className="font-[var(--weight-medium)]">{drawer.employee_name}</TableCell>
                <TableCell className="text-[color:var(--color-text-muted)]">
                  {formatTime(drawer.opened_at)}
                  {drawer.closed_at ? ` - ${formatTime(drawer.closed_at)}` : ' (open)'}
                </TableCell>
                <TableCell align="right" className="tabular-nums">${drawer.starting_cash.toFixed(2)}</TableCell>
                <TableCell align="right" className="tabular-nums">${drawer.cash_sales.toFixed(2)}</TableCell>
                <TableCell align="right" className="tabular-nums">${drawer.cash_payouts.toFixed(2)}</TableCell>
                <TableCell align="right" className="tabular-nums">${drawer.expected_cash.toFixed(2)}</TableCell>
                <TableCell align="right" className="tabular-nums">${drawer.actual_cash.toFixed(2)}</TableCell>
                <TableCell align="right" className="tabular-nums font-[var(--weight-semibold)]" style={{ color: TOLERANCE_COLORS[drawer.tolerance_level] }}>
                  {drawer.over_short >= 0 ? '+' : ''}{drawer.over_short.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 border-[color:var(--color-text)] font-[var(--weight-bold)]">
              <TableCell colSpan={2}>Total ({summary.drawer_count} drawers)</TableCell>
              <TableCell align="right" className="tabular-nums">${summary.total_starting.toFixed(2)}</TableCell>
              <TableCell align="right" className="tabular-nums">${summary.total_cash_sales.toFixed(2)}</TableCell>
              <TableCell align="right" className="tabular-nums">${summary.total_payouts.toFixed(2)}</TableCell>
              <TableCell align="right" className="tabular-nums">${summary.total_expected.toFixed(2)}</TableCell>
              <TableCell align="right" className="tabular-nums">${summary.total_actual.toFixed(2)}</TableCell>
              <TableCell align="right" className="tabular-nums" style={{ color: summaryToleranceColor(summary.total_over_short) }}>
                {summary.total_over_short >= 0 ? '+' : ''}{summary.total_over_short.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  )
}
