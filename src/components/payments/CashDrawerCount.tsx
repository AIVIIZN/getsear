'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn, formatMoney } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Minus, Plus, DollarSign, CheckCircle2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Denominations {
  hundreds: number
  fifties: number
  twenties: number
  tens: number
  fives: number
  ones: number
  quarters: number
  dimes: number
  nickels: number
  pennies: number
}

interface CashDrawerCountProps {
  mode: 'opening' | 'closing'
  drawerId: string
  expectedCents?: number // Only for closing count
  onComplete: (data: {
    denominations: Denominations
    totalCents: number
  }) => void
  onCancel: () => void
  isSubmitting?: boolean
}

// ---------------------------------------------------------------------------
// Denomination definitions
// ---------------------------------------------------------------------------

const DENOMINATIONS = [
  { key: 'hundreds' as const, label: '$100', valueCents: 10000, isCoin: false },
  { key: 'fifties' as const, label: '$50', valueCents: 5000, isCoin: false },
  { key: 'twenties' as const, label: '$20', valueCents: 2000, isCoin: false },
  { key: 'tens' as const, label: '$10', valueCents: 1000, isCoin: false },
  { key: 'fives' as const, label: '$5', valueCents: 500, isCoin: false },
  { key: 'ones' as const, label: '$1', valueCents: 100, isCoin: false },
  { key: 'quarters' as const, label: '25c', valueCents: 25, isCoin: true },
  { key: 'dimes' as const, label: '10c', valueCents: 10, isCoin: true },
  { key: 'nickels' as const, label: '5c', valueCents: 5, isCoin: true },
  { key: 'pennies' as const, label: '1c', valueCents: 1, isCoin: true },
] as const

const INITIAL_DENOMINATIONS: Denominations = {
  hundreds: 0,
  fifties: 0,
  twenties: 0,
  tens: 0,
  fives: 0,
  ones: 0,
  quarters: 0,
  dimes: 0,
  nickels: 0,
  pennies: 0,
}

// ---------------------------------------------------------------------------
// Severity helpers for over/short
// ---------------------------------------------------------------------------

function getOverShortColor(varianceCents: number): string {
  const abs = Math.abs(varianceCents)
  if (abs <= 500) return 'text-green-600'     // < $5
  if (abs <= 2000) return 'text-amber-600'    // $5 - $20
  return 'text-red-600'                       // > $20
}

function getOverShortLabel(varianceCents: number): string {
  if (varianceCents === 0) return 'Even'
  return varianceCents > 0 ? 'Over' : 'Short'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CashDrawerCount({
  mode,
  drawerId,
  expectedCents,
  onComplete,
  onCancel,
  isSubmitting = false,
}: CashDrawerCountProps) {
  const [denominations, setDenominations] = useState<Denominations>(INITIAL_DENOMINATIONS)

  const totalCents = useMemo(() => {
    return DENOMINATIONS.reduce(
      (sum, d) => sum + denominations[d.key] * d.valueCents,
      0
    )
  }, [denominations])

  const overShortCents = useMemo(() => {
    if (mode !== 'closing' || expectedCents === undefined) return null
    return totalCents - expectedCents
  }, [mode, expectedCents, totalCents])

  const updateDenomination = useCallback(
    (key: keyof Denominations, delta: number) => {
      setDenominations((prev) => ({
        ...prev,
        [key]: Math.max(0, prev[key] + delta),
      }))
    },
    []
  )

  const setDenominationValue = useCallback(
    (key: keyof Denominations, value: number) => {
      setDenominations((prev) => ({
        ...prev,
        [key]: Math.max(0, value),
      }))
    },
    []
  )

  const handleComplete = useCallback(() => {
    onComplete({
      denominations,
      totalCents,
    })
  }, [denominations, totalCents, onComplete])

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200">
        <h2 className="text-lg font-semibold text-stone-900">
          {mode === 'opening' ? 'Opening Count' : 'Closing Count'}
        </h2>
        <p className="text-sm text-stone-500 mt-0.5">
          {mode === 'opening'
            ? 'Count your starting bank'
            : 'Count drawer contents at end of shift'}
        </p>
      </div>

      {/* Denomination Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Bills */}
        <div className="mb-4">
          <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
            Bills
          </h3>
          <div className="space-y-1.5">
            {DENOMINATIONS.filter((d) => !d.isCoin).map((denom) => (
              <DenominationRow
                key={denom.key}
                label={denom.label}
                valueCents={denom.valueCents}
                quantity={denominations[denom.key]}
                onIncrement={() => updateDenomination(denom.key, 1)}
                onDecrement={() => updateDenomination(denom.key, -1)}
                onIncrementFive={() => updateDenomination(denom.key, 5)}
                onSetValue={(v) => setDenominationValue(denom.key, v)}
              />
            ))}
          </div>
        </div>

        {/* Coins */}
        <div>
          <h3 className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
            Coins
          </h3>
          <div className="space-y-1.5">
            {DENOMINATIONS.filter((d) => d.isCoin).map((denom) => (
              <DenominationRow
                key={denom.key}
                label={denom.label}
                valueCents={denom.valueCents}
                quantity={denominations[denom.key]}
                onIncrement={() => updateDenomination(denom.key, 1)}
                onDecrement={() => updateDenomination(denom.key, -1)}
                onIncrementFive={() => updateDenomination(denom.key, 5)}
                onSetValue={(v) => setDenominationValue(denom.key, v)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer / Summary */}
      <div className="border-t border-stone-200 px-4 py-3 bg-stone-50/80">
        {/* Running Total */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-stone-600">
            <DollarSign className="inline size-4 mr-1" />
            Total Counted
          </span>
          <span className="text-2xl font-bold tabular-nums text-stone-900">
            {formatMoney(totalCents)}
          </span>
        </div>

        {/* Over/Short (closing only) */}
        {mode === 'closing' && expectedCents !== undefined && (
          <div className="flex items-center justify-between mb-3 py-2 px-3 rounded-lg bg-white border border-stone-200">
            <div>
              <div className="text-xs text-stone-500">Expected</div>
              <div className="text-sm font-medium tabular-nums text-stone-700">
                {formatMoney(expectedCents)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-stone-500">
                {getOverShortLabel(overShortCents ?? 0)}
              </div>
              <div
                className={cn(
                  'text-lg font-bold tabular-nums',
                  getOverShortColor(overShortCents ?? 0)
                )}
              >
                {overShortCents !== null
                  ? `${overShortCents >= 0 ? '+' : ''}${formatMoney(Math.abs(overShortCents))}`
                  : '--'}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-12"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white"
            onClick={handleComplete}
            disabled={isSubmitting || totalCents === 0}
          >
            {isSubmitting ? (
              'Submitting...'
            ) : (
              <>
                <CheckCircle2 className="size-5 mr-1.5" />
                Count Complete
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Denomination Row
// ---------------------------------------------------------------------------

interface DenominationRowProps {
  label: string
  valueCents: number
  quantity: number
  onIncrement: () => void
  onDecrement: () => void
  onIncrementFive: () => void
  onSetValue: (value: number) => void
}

function DenominationRow({
  label,
  valueCents,
  quantity,
  onIncrement,
  onDecrement,
  onIncrementFive,
  onSetValue,
}: DenominationRowProps) {
  const subtotalCents = quantity * valueCents

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-stone-50 transition-colors">
      {/* Denomination label */}
      <div className="w-12 text-sm font-semibold text-stone-700">{label}</div>

      {/* Quantity stepper */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex items-center justify-center size-9 rounded-lg bg-stone-100 hover:bg-stone-200 active:bg-stone-300 transition-colors touch-manipulation"
          onClick={onDecrement}
          disabled={quantity === 0}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="size-4 text-stone-600" />
        </button>

        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={quantity}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10)
            if (!isNaN(val)) setDenominationValue(val)
          }}
          className="w-14 h-9 text-center text-sm font-medium tabular-nums bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
          aria-label={`${label} quantity`}
        />

        <button
          type="button"
          className="flex items-center justify-center size-9 rounded-lg bg-stone-100 hover:bg-stone-200 active:bg-stone-300 transition-colors touch-manipulation"
          onClick={onIncrement}
          aria-label={`Increase ${label}`}
        >
          <Plus className="size-4 text-stone-600" />
        </button>

        <button
          type="button"
          className="flex items-center justify-center h-9 px-2 rounded-lg bg-stone-100 hover:bg-stone-200 active:bg-stone-300 transition-colors touch-manipulation text-xs font-medium text-stone-500"
          onClick={onIncrementFive}
          aria-label={`Add 5 ${label}`}
        >
          +5
        </button>
      </div>

      {/* Subtotal */}
      <div className="flex-1 text-right text-sm tabular-nums text-stone-500">
        {subtotalCents > 0 ? formatMoney(subtotalCents) : '--'}
      </div>
    </div>
  )

  function setDenominationValue(val: number) {
    onSetValue(val)
  }
}
