'use client'

import { useState, useCallback, useMemo } from 'react'
import { DoorOpen } from 'lucide-react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import {
  calculateChangeDenominations,
  formatCentsToDollars,
} from '@/lib/payments/dual-pricing'
import { cn } from '@/lib/utils'

interface CashTenderProps {
  totalCents: number
  /** Cash price if dual pricing is enabled (lower than totalCents) */
  cashPriceCents?: number
  /** Whether dual pricing is active for this location */
  isDualPricingEnabled?: boolean
  /** Savings amount in cents (totalCents - cashPriceCents) */
  savingsCents?: number
  /** Allow partial cash payment (for multi-tender) */
  allowPartial?: boolean
  onComplete: (tenderedCents: number) => void
  onOpenDrawer?: () => void
}

const QUICK_AMOUNTS = [
  { label: 'Exact', cents: 0 },
  { label: '$20', cents: 2000 },
  { label: '$50', cents: 5000 },
  { label: '$100', cents: 10000 },
]

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', 'C']

export function CashTender({
  totalCents,
  cashPriceCents,
  isDualPricingEnabled = false,
  savingsCents = 0,
  allowPartial = false,
  onComplete,
  onOpenDrawer,
}: CashTenderProps) {
  const [inputStr, setInputStr] = useState('')

  // Use cash price if dual pricing is enabled
  const effectiveTotal = isDualPricingEnabled && cashPriceCents !== undefined
    ? cashPriceCents
    : totalCents

  // Input is in cents (no decimal point needed)
  const tenderedCents = inputStr ? parseInt(inputStr, 10) : 0
  const changeDueCents = Math.max(0, tenderedCents - effectiveTotal)
  const isExactOrOver = tenderedCents >= effectiveTotal
  const isShort = tenderedCents > 0 && tenderedCents < effectiveTotal
  const shortAmount = isShort ? effectiveTotal - tenderedCents : 0

  // Change denomination breakdown
  const denominations = useMemo(
    () => calculateChangeDenominations(changeDueCents),
    [changeDueCents]
  )

  const handleKey = useCallback((key: string) => {
    if (key === 'C') {
      setInputStr('')
      return
    }
    setInputStr((prev) => {
      const next = prev + key
      // Cap at $99,999.99
      if (parseInt(next, 10) > 9999999) return prev
      return next
    })
  }, [])

  const handleQuickAmount = useCallback(
    (cents: number) => {
      if (cents === 0) {
        // Exact change — complete immediately
        onComplete(effectiveTotal)
      } else {
        setInputStr(String(cents))
      }
    },
    [effectiveTotal, onComplete]
  )

  const handleOpenDrawer = useCallback(() => {
    if (onOpenDrawer) {
      onOpenDrawer()
    } else {
      // Fallback: call the printer cash drawer kick API
      fetch('/api/printers/kick-drawer', { method: 'POST' }).catch(() => {
        // Silently fail — drawer kick is best-effort
      })
    }
  }, [onOpenDrawer])

  const handleComplete = useCallback(() => {
    if (allowPartial && tenderedCents > 0) {
      // In partial mode, accept any amount
      onComplete(tenderedCents)
    } else if (isExactOrOver) {
      onComplete(tenderedCents)
    }
  }, [tenderedCents, isExactOrOver, allowPartial, onComplete])

  const canComplete = allowPartial ? tenderedCents > 0 : isExactOrOver

  return (
    <div className="flex flex-col gap-5">
      {/* Total due */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Total Due</p>
        <MoneyDisplay cents={effectiveTotal} className="text-3xl font-bold text-foreground" />

        {/* Dual pricing indicator */}
        {isDualPricingEnabled && savingsCents > 0 && (
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              Cash Discount: Save {formatCentsToDollars(savingsCents)}
            </span>
          </div>
        )}
        {isDualPricingEnabled && cashPriceCents !== undefined && cashPriceCents !== totalCents && (
          <p className="mt-1 text-xs text-muted-foreground">
            Card price: <MoneyDisplay cents={totalCents} className="inline text-xs line-through" />
          </p>
        )}
      </div>

      {/* Cash tendered display */}
      <div className="rounded-xl bg-secondary p-4 text-center">
        <p className="text-sm text-muted-foreground">Cash Tendered</p>
        <MoneyDisplay
          cents={tenderedCents}
          className={cn(
            'text-4xl font-bold',
            tenderedCents > 0 ? 'text-foreground' : 'text-muted-foreground'
          )}
        />
      </div>

      {/* Change due / short amount */}
      <div className="text-center">
        {isExactOrOver && changeDueCents > 0 && (
          <>
            <p className="text-sm text-muted-foreground">Change Due</p>
            <MoneyDisplay
              cents={changeDueCents}
              className="text-3xl font-bold text-green-600"
            />
            {/* Denomination breakdown */}
            {denominations.length > 0 && (
              <div className="mt-2 rounded-lg bg-green-50 px-3 py-2">
                <p className="text-xs font-medium text-green-700">
                  {denominations
                    .map((d) => {
                      const plural =
                        d.count > 1 &&
                        ['quarter', 'dime', 'nickel', 'penny'].includes(d.label)
                      const label = plural
                        ? d.label === 'penny'
                          ? 'pennies'
                          : `${d.label}s`
                        : d.label
                      return `${d.count}x ${label}`
                    })
                    .join(', ')}
                </p>
              </div>
            )}
          </>
        )}
        {isExactOrOver && changeDueCents === 0 && tenderedCents > 0 && (
          <>
            <p className="text-sm text-muted-foreground">Change Due</p>
            <p className="text-2xl font-bold text-green-600">Exact</p>
          </>
        )}
        {isShort && !allowPartial && (
          <>
            <p className="text-sm text-muted-foreground">Short by</p>
            <MoneyDisplay
              cents={shortAmount}
              className="text-2xl font-bold text-red-500"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Collect more cash or add another payment
            </p>
          </>
        )}
        {isShort && allowPartial && (
          <>
            <p className="text-sm text-muted-foreground">Remaining Balance</p>
            <MoneyDisplay
              cents={shortAmount}
              className="text-2xl font-bold text-amber-600"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Will need another payment for the remainder
            </p>
          </>
        )}
        {!tenderedCents && (
          <>
            <p className="text-sm text-muted-foreground">Change Due</p>
            <MoneyDisplay cents={0} className="text-2xl font-bold text-muted-foreground" />
          </>
        )}
      </div>

      {/* Quick amount buttons */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK_AMOUNTS.map((qa) => (
          <button
            key={qa.label}
            onClick={() => handleQuickAmount(qa.cents)}
            className={cn(
              'btn-press touch-target-lg rounded-lg bg-accent px-3 py-3 text-sm font-semibold',
              'text-accent-foreground transition-colors hover:bg-accent/80'
            )}
          >
            {qa.label === 'Exact' ? `Exact` : qa.label}
          </button>
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2">
        {NUMPAD_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            className={cn(
              'btn-press touch-target-lg rounded-lg py-4 text-xl font-semibold transition-colors',
              key === 'C'
                ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                : 'bg-secondary text-foreground hover:bg-secondary/80'
            )}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        {/* Open Drawer */}
        <button
          onClick={handleOpenDrawer}
          className="btn-press touch-target-lg flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80"
        >
          <DoorOpen className="size-4" />
          Open Drawer
        </button>

        {/* Complete button */}
        <button
          onClick={handleComplete}
          disabled={!canComplete}
          className={cn(
            'btn-press touch-target-lg flex-1 rounded-xl py-4 text-lg font-bold transition-all',
            canComplete
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'cursor-not-allowed bg-muted text-muted-foreground'
          )}
        >
          {allowPartial && isShort
            ? 'Apply Partial Cash'
            : 'Accept Cash'}
        </button>
      </div>
    </div>
  )
}
