'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

export function CashDrawerTable({ drawers, summary }: CashDrawerTableProps) {
  return (
    <Card className="shadow-warm-sm">
      <CardHeader>
        <CardTitle className="text-base">Cash Drawer Reconciliation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-3 font-medium text-[var(--muted-foreground)]">Employee</th>
                <th className="text-left py-3 px-3 font-medium text-[var(--muted-foreground)]">Shift</th>
                <th className="text-right py-3 px-3 font-medium text-[var(--muted-foreground)]">Opening</th>
                <th className="text-right py-3 px-3 font-medium text-[var(--muted-foreground)]">Cash Sales</th>
                <th className="text-right py-3 px-3 font-medium text-[var(--muted-foreground)]">Payouts</th>
                <th className="text-right py-3 px-3 font-medium text-[var(--muted-foreground)]">Expected</th>
                <th className="text-right py-3 px-3 font-medium text-[var(--muted-foreground)]">Actual</th>
                <th className="text-right py-3 px-3 font-medium text-[var(--muted-foreground)]">Over/Short</th>
              </tr>
            </thead>
            <tbody>
              {drawers.map((drawer) => (
                <tr key={drawer.drawer_id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)] even:bg-[var(--secondary)]/30">
                  <td className="py-3 px-3 font-medium">{drawer.employee_name}</td>
                  <td className="py-3 px-3 text-[var(--muted-foreground)]">
                    {formatTime(drawer.opened_at)}
                    {drawer.closed_at ? ` - ${formatTime(drawer.closed_at)}` : ' (open)'}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">${drawer.starting_cash.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">${drawer.cash_sales.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">${drawer.cash_payouts.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">${drawer.expected_cash.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right tabular-nums">${drawer.actual_cash.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right tabular-nums font-semibold" style={{ color: TOLERANCE_COLORS[drawer.tolerance_level] }}>
                    {drawer.over_short >= 0 ? '+' : ''}{drawer.over_short.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--foreground)] font-bold">
                <td className="py-3 px-3" colSpan={2}>Total ({summary.drawer_count} drawers)</td>
                <td className="py-3 px-3 text-right tabular-nums">${summary.total_starting.toFixed(2)}</td>
                <td className="py-3 px-3 text-right tabular-nums">${summary.total_cash_sales.toFixed(2)}</td>
                <td className="py-3 px-3 text-right tabular-nums">${summary.total_payouts.toFixed(2)}</td>
                <td className="py-3 px-3 text-right tabular-nums">${summary.total_expected.toFixed(2)}</td>
                <td className="py-3 px-3 text-right tabular-nums">${summary.total_actual.toFixed(2)}</td>
                <td className="py-3 px-3 text-right tabular-nums font-bold" style={{
                  color: Math.abs(summary.total_over_short) <= 5 ? '#16A34A' : Math.abs(summary.total_over_short) <= 20 ? '#D97706' : '#DC2626'
                }}>
                  {summary.total_over_short >= 0 ? '+' : ''}{summary.total_over_short.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
