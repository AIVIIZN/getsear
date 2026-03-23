'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IRS8027SectionProps {
  grossReceiptsCents: number
  chargeReceiptsCents: number
  chargeTipsCents: number
  serviceChargesCents: number
  totalReportedTipsCents: number
}

export function IRS8027Section({
  grossReceiptsCents,
  chargeReceiptsCents,
  chargeTipsCents,
  serviceChargesCents,
  totalReportedTipsCents,
}: IRS8027SectionProps) {
  const [expanded, setExpanded] = useState(false)

  const threshold = Math.round(grossReceiptsCents * 0.08)
  const shortfall = Math.max(0, threshold - totalReportedTipsCents)
  const belowThreshold = totalReportedTipsCents < threshold

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">IRS 8027 Data</span>
        </div>
        {belowThreshold && (
          <div className="flex items-center gap-1.5 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Below 8% threshold</span>
          </div>
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          <div className="space-y-2">
            <Row label="Gross Receipts" cents={grossReceiptsCents} />
            <Row label="Charge Receipts" cents={chargeReceiptsCents} />
            <Row label="Charge Tips" cents={chargeTipsCents} />
            <Row label="Service Charges" cents={serviceChargesCents} />
            <div className="border-t border-border pt-2">
              <Row label="Total Reported Tips" cents={totalReportedTipsCents} bold />
            </div>
            <Row label="8% of Gross Receipts" cents={threshold} />
          </div>

          {belowThreshold && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Tip Allocation Required</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Reported tips are ${(shortfall / 100).toFixed(2)} below the 8% threshold.
                    Tip allocation must be calculated and reported on Form 8027.
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Allocation amount: <span className="font-mono font-semibold">${(shortfall / 100).toFixed(2)}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {!belowThreshold && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-sm text-green-700">
                Reported tips meet or exceed the 8% threshold. No tip allocation required.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, cents, bold = false }: { label: string; cents: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-sm', bold ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
      <span className={cn('text-sm font-mono', bold && 'font-semibold')}>
        ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    </div>
  )
}
