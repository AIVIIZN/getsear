'use client'

import { useState, useMemo, useCallback } from 'react'
import { DollarSign, Coins } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { US_DENOMINATIONS, calculateCashCount, type DenominationCount } from '@/lib/staff/denomination-calculator'
import { cn } from '@/lib/utils'

interface DenominationCounterProps {
  onChange: (counts: DenominationCount[], totalCents: number) => void
  expectedCents?: number
  initialCounts?: DenominationCount[]
}

export function DenominationCounter({
  onChange,
  expectedCents,
  initialCounts,
}: DenominationCounterProps) {
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const d of US_DENOMINATIONS) {
      const init = initialCounts?.find((c) => c.key === d.key)
      initial[d.key] = init?.quantity ?? 0
    }
    return initial
  })

  const cashCount = useMemo(() => {
    const denomCounts = US_DENOMINATIONS.map((d) => ({
      key: d.key,
      quantity: counts[d.key] ?? 0,
    }))
    return calculateCashCount(denomCounts)
  }, [counts])

  const handleChange = useCallback(
    (key: string, value: number) => {
      const newCounts = { ...counts, [key]: Math.max(0, value) }
      setCounts(newCounts)

      const denomCounts = US_DENOMINATIONS.map((d) => ({
        key: d.key,
        quantity: newCounts[d.key] ?? 0,
      }))
      const result = calculateCashCount(denomCounts)
      onChange(denomCounts, result.totalCents)
    },
    [counts, onChange]
  )

  const overShortCents = expectedCents !== undefined ? cashCount.totalCents - expectedCents : null

  return (
    <div className="space-y-4">
      {/* Bills */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Bills</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {US_DENOMINATIONS.filter((d) => d.type === 'bill').map((denom) => {
            const qty = counts[denom.key] ?? 0
            const subtotal = qty * denom.valueCents
            return (
              <div
                key={denom.key}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <span className="text-sm font-semibold text-foreground w-10 shrink-0">
                  {denom.label}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={qty || ''}
                  onChange={(e) => handleChange(denom.key, parseInt(e.target.value) || 0)}
                  className="h-12 text-center text-lg font-mono font-semibold w-20"
                  placeholder="0"
                />
                <span className="text-sm text-muted-foreground font-mono w-16 text-right shrink-0">
                  ${(subtotal / 100).toFixed(2)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Coins */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Coins className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Coins</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {US_DENOMINATIONS.filter((d) => d.type === 'coin').map((denom) => {
            const qty = counts[denom.key] ?? 0
            const subtotal = qty * denom.valueCents
            return (
              <div
                key={denom.key}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <span className="text-xs font-semibold text-foreground w-14 shrink-0">
                  {denom.label}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={qty || ''}
                  onChange={(e) => handleChange(denom.key, parseInt(e.target.value) || 0)}
                  className="h-12 text-center text-lg font-mono font-semibold w-16"
                  placeholder="0"
                />
                <span className="text-sm text-muted-foreground font-mono w-14 text-right shrink-0">
                  ${(subtotal / 100).toFixed(2)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Running Total */}
      <div className="rounded-xl border-2 border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Total Count</span>
          <span className="text-3xl font-bold font-mono text-foreground">
            ${(cashCount.totalCents / 100).toFixed(2)}
          </span>
        </div>

        {expectedCents !== undefined && overShortCents !== null && (
          <>
            <div className="border-t border-border mt-3 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Expected</span>
                <span className="text-lg font-semibold font-mono">
                  ${(expectedCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Over/Short</span>
                <span
                  className={cn(
                    'text-xl font-bold font-mono',
                    overShortCents === 0
                      ? 'text-green-600'
                      : overShortCents > 0
                        ? 'text-green-600'
                        : 'text-red-600'
                  )}
                >
                  {overShortCents === 0
                    ? 'Even'
                    : `${overShortCents > 0 ? '+' : '-'}$${(Math.abs(overShortCents) / 100).toFixed(2)}`}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
