'use client'

import { useState } from 'react'
import { Printer, DollarSign, Loader2, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/shared/EmptyState'
import type { StaffMember } from '@/stores/staff-store'

interface CheckoutResult {
  netSalesCents: number
  totalChecks: number
  avgCheckCents: number
  guestCount: number
  cardTipsCents: number
  autoGratuityCents: number
  cashTipsDeclaredCents: number
  tipOutOwedCents: number
  tipOutReceivedCents: number
  netTipsCents: number
  startingCashCents: number
  cashSalesReceivedCents: number
  cashTipsKeptCents: number
  cashOwedToHouseCents: number
  hoursWorked: number
  tipsPerHour: number
}

interface ServerCheckoutProps {
  staff: StaffMember[]
}

function MoneyLine({ label, cents, bold = false, negative = false }: { label: string; cents: number; bold?: boolean; negative?: boolean }) {
  const formatted = `$${(Math.abs(cents) / 100).toFixed(2)}`
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-sm ${bold ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
      <span className={`text-sm font-mono ${bold ? 'font-bold text-foreground' : ''} ${negative ? 'text-red-600' : ''}`}>
        {negative && cents > 0 ? '-' : ''}{formatted}
      </span>
    </div>
  )
}

export function ServerCheckout({ staff }: ServerCheckoutProps) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [cashTipsDeclared, setCashTipsDeclared] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckoutResult | null>(null)

  const activeStaff = staff.filter((s) => s.is_active && ['server', 'bartender', 'cashier'].includes(s.role))

  const handleCalculate = async () => {
    if (!selectedUserId) {
      toast.error('Select an employee')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/staff/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUserId,
          date: new Date().toISOString().split('T')[0],
          location_id: 'default',
          cash_tips_declared_cents: Math.round(parseFloat(cashTipsDeclared || '0') * 100),
          starting_cash_cents: 20000, // $200 default
        }),
      })

      if (res.ok) {
        const json = await res.json()
        setResult(json.data)
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to calculate checkout')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      {/* Employee selection */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Employee</Label>
          <Select value={selectedUserId} onValueChange={(v) => v !== null && setSelectedUserId(v)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Select employee..." />
            </SelectTrigger>
            <SelectContent>
              {activeStaff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Cash Tips Declared ($)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={cashTipsDeclared}
            onChange={(e) => setCashTipsDeclared(e.target.value)}
            placeholder="0.00"
            className="h-10"
          />
        </div>

        <Button onClick={handleCalculate} disabled={loading || !selectedUserId} className="w-full">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
          Calculate Checkout
        </Button>
      </div>

      {/* Checkout Receipt Card */}
      {result ? (
        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-sm font-bold uppercase tracking-wider">
              Server Checkout Report
            </CardTitle>
            <p className="text-center text-xs text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sales Summary */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Sales Summary
              </p>
              <MoneyLine label="Net Sales" cents={result.netSalesCents} bold />
              <MoneyLine label="Total Checks" cents={0} />
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">Total Checks</span>
                <span className="text-sm font-mono">{result.totalChecks}</span>
              </div>
              <MoneyLine label="Avg Check" cents={result.avgCheckCents} />
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">Guest Count</span>
                <span className="text-sm font-mono">{result.guestCount}</span>
              </div>
            </div>

            <Separator />

            {/* Tip Summary */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Tip Summary
              </p>
              <MoneyLine label="Card Tips" cents={result.cardTipsCents} />
              <MoneyLine label="Auto-Gratuity" cents={result.autoGratuityCents} />
              <MoneyLine label="Cash Tips Declared" cents={result.cashTipsDeclaredCents} />
              <MoneyLine label="Tip-out Owed" cents={result.tipOutOwedCents} negative />
              <MoneyLine label="Tip-out Received" cents={result.tipOutReceivedCents} />
              <Separator className="my-1" />
              <MoneyLine label="Net Tips" cents={result.netTipsCents} bold />
            </div>

            <Separator />

            {/* Cash Owed */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Cash Owed to House
              </p>
              <MoneyLine label="Starting Cash" cents={result.startingCashCents} />
              <MoneyLine label="+ Cash Sales" cents={result.cashSalesReceivedCents} />
              <MoneyLine label="- Cash Tips Kept" cents={result.cashTipsKeptCents} negative />
              <Separator className="my-1" />
              <MoneyLine label="Cash Due" cents={result.cashOwedToHouseCents} bold />
            </div>

            <Separator />

            {/* Labor */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Hours: {result.hoursWorked.toFixed(1)}</span>
              <span>Tips/hr: ${result.tipsPerHour.toFixed(2)}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 gap-1" size="sm">
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
              <Button className="flex-1" size="sm">
                Complete Checkout
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !loading && (
        <EmptyState
          icon={DollarSign}
          title="Server Checkout"
          description="Select an employee and calculate their end-of-shift checkout report."
        />
      )}
    </div>
  )
}
