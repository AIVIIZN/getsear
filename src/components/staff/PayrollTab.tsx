'use client'

import { useEffect, useState, useCallback } from 'react'
import { Download, Clock, DollarSign, TrendingUp, AlertCircle, Banknote } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { PayrollExportDialog } from './PayrollExportDialog'
import { IRS8027Section } from './IRS8027Section'

interface PayrollEntry {
  userId: string
  name: string
  role: string
  regularHours: number
  otHours: number
  regularPay: number
  otPay: number
  totalPay: number
  cardTips: number
  cashTips: number
  tipPoolShare: number
  totalComp: number
  isApproved: boolean
}

export function PayrollTab() {
  const [periodType, setPeriodType] = useState('weekly')
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return d.toISOString().split('T')[0]
  })
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    d.setDate(d.getDate() + (day === 0 ? 0 : 7 - day))
    return d.toISOString().split('T')[0]
  })
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)

  const loadPayroll = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch time entries for the period and aggregate
      const res = await fetch(`/api/staff/time-entries?start=${periodStart}&end=${periodEnd}`)
      if (res.ok) {
        const json = await res.json()
        // Aggregate by user
        const userMap = new Map<string, PayrollEntry>()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const e of (json.data ?? []) as any[]) {
          const existing = userMap.get(e.user_id) ?? {
            userId: e.user_id,
            name: e.staff_name ?? 'Unknown',
            role: e.role_during_shift ?? 'staff',
            regularHours: 0, otHours: 0,
            regularPay: 0, otPay: 0, totalPay: 0,
            cardTips: 0, cashTips: 0, tipPoolShare: 0, totalComp: 0,
            isApproved: true,
          }

          existing.regularHours += parseFloat(e.regular_hours ?? '0')
          existing.otHours += parseFloat(e.overtime_hours ?? '0')
          const rate = parseFloat(e.hourly_rate ?? '0')
          existing.regularPay += parseFloat(e.regular_hours ?? '0') * rate
          existing.otPay += parseFloat(e.overtime_hours ?? '0') * rate * 1.5
          existing.totalPay = existing.regularPay + existing.otPay
          existing.cardTips += parseFloat(e.credit_tips ?? '0')
          existing.cashTips += parseFloat(e.cash_tips ?? '0')
          existing.tipPoolShare += parseFloat(e.tip_out_received ?? '0')
          existing.totalComp = existing.totalPay + existing.cardTips + existing.cashTips + existing.tipPoolShare
          if (!e.is_approved) existing.isApproved = false

          userMap.set(e.user_id, existing)
        }

        setEntries(Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [periodStart, periodEnd])

  useEffect(() => { loadPayroll() }, [loadPayroll])

  const unapprovedCount = entries.filter((e) => !e.isApproved).length
  const totalRegHours = entries.reduce((s, e) => s + e.regularHours, 0)
  const totalOtHours = entries.reduce((s, e) => s + e.otHours, 0)
  const totalLaborCost = entries.reduce((s, e) => s + e.totalPay, 0)
  const totalTips = entries.reduce((s, e) => s + e.cardTips + e.cashTips, 0)
  const avgHourlyCost = (totalRegHours + totalOtHours) > 0 ? totalLaborCost / (totalRegHours + totalOtHours) : 0

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={periodType} onValueChange={(v) => v && setPeriodType(v)}>
          <SelectTrigger className="w-[140px] h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="biweekly">Bi-Weekly</SelectItem>
            <SelectItem value="semimonthly">Semi-Monthly</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-36 h-10" />
        <span className="text-sm text-muted-foreground">to</span>
        <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-36 h-10" />
        <div className="ml-auto">
          <Button onClick={() => setExportOpen(true)} className="gap-2">
            <Download className="h-4 w-4" />
            Export Payroll
          </Button>
        </div>
      </div>

      {/* Unapproved banner */}
      {unapprovedCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-800 font-medium">
            {unapprovedCount} unapproved time entr{unapprovedCount === 1 ? 'y' : 'ies'} in this period
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Reg Hours</span>
            </div>
            <p className="text-xl font-bold font-mono">{totalRegHours.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">OT Hours</span>
            </div>
            <p className="text-xl font-bold font-mono text-red-600">{totalOtHours.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Labor Cost</span>
            </div>
            <p className="text-xl font-bold font-mono">${totalLaborCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Tips</span>
            </div>
            <p className="text-xl font-bold font-mono">${totalTips.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Avg $/hr</span>
            </div>
            <p className="text-xl font-bold font-mono">${avgHourlyCost.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payroll table */}
      {loading ? (
        <div className="animate-pulse space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}</div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No payroll data"
          description="No payroll data for this period. Time entries appear here once employees clock in."
        />
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Reg Hours</TableHead>
                <TableHead className="text-right">OT Hours</TableHead>
                <TableHead className="text-right">Reg Pay</TableHead>
                <TableHead className="text-right">OT Pay</TableHead>
                <TableHead className="text-right">Total Pay</TableHead>
                <TableHead className="text-right">Card Tips</TableHead>
                <TableHead className="text-right">Cash Tips</TableHead>
                <TableHead className="text-right">Pool Share</TableHead>
                <TableHead className="text-right font-semibold">Total Comp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.userId}>
                  <TableCell className="text-sm font-medium">
                    {e.name}
                    {!e.isApproved && (
                      <AlertCircle className="inline h-3 w-3 text-amber-500 ml-1" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">{e.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm font-mono text-right">{e.regularHours.toFixed(1)}</TableCell>
                  <TableCell className="text-sm font-mono text-right">
                    {e.otHours > 0 ? <span className="text-red-600">{e.otHours.toFixed(1)}</span> : '--'}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-right">${e.regularPay.toFixed(2)}</TableCell>
                  <TableCell className="text-sm font-mono text-right">
                    {e.otPay > 0 ? `$${e.otPay.toFixed(2)}` : '--'}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-right font-medium">${e.totalPay.toFixed(2)}</TableCell>
                  <TableCell className="text-sm font-mono text-right">${e.cardTips.toFixed(2)}</TableCell>
                  <TableCell className="text-sm font-mono text-right">${e.cashTips.toFixed(2)}</TableCell>
                  <TableCell className="text-sm font-mono text-right">
                    {e.tipPoolShare > 0 ? `$${e.tipPoolShare.toFixed(2)}` : '--'}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-right font-bold">${e.totalComp.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* IRS 8027 */}
      <IRS8027Section
        grossReceiptsCents={0}
        chargeReceiptsCents={0}
        chargeTipsCents={Math.round(totalTips * 100)}
        serviceChargesCents={0}
        totalReportedTipsCents={Math.round(totalTips * 100)}
      />

      <PayrollExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        periodStart={periodStart}
        periodEnd={periodEnd}
      />
    </div>
  )
}
