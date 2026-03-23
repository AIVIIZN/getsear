'use client'

import { useState, useCallback, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { cn } from '@/lib/utils'

interface TipSelectorProps {
  /** Pre-tax subtotal in cents (tip percentages calculated on this) */
  subtotalCents: number
  /** Total including tax (for display purposes) */
  totalCents?: number
  /** Called when a tip is confirmed */
  onSelect: (tipCents: number) => void
  /** If true, shows a post-auth entry mode (server enters exact dollar amount from receipt) */
  postAuthMode?: boolean
  /** Tip percentages to show (defaults to [18, 20, 22, 25]) */
  tipPercentages?: number[]
}

const DEFAULT_TIP_PERCENTAGES = [18, 20, 22, 25]
const TIP_WARNING_THRESHOLD = 0.5 // Warn if tip > 50% of check
const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', 'C']

export function TipSelector({
  subtotalCents,
  totalCents,
  onSelect,
  postAuthMode = false,
  tipPercentages = DEFAULT_TIP_PERCENTAGES,
}: TipSelectorProps) {
  const [customMode, setCustomMode] = useState(postAuthMode)
  const [customInput, setCustomInput] = useState('')
  const [selectedTip, setSelectedTip] = useState<number | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [pendingTip, setPendingTip] = useState<number | null>(null)

  const displayTotal = totalCents ?? subtotalCents
  const customCents = customInput ? parseInt(customInput, 10) : 0

  // Check if tip exceeds warning threshold
  const isTipExcessive = useCallback(
    (tipCents: number) => tipCents > displayTotal * TIP_WARNING_THRESHOLD,
    [displayTotal]
  )

  const confirmTip = useCallback(
    (tipCents: number) => {
      if (isTipExcessive(tipCents)) {
        setPendingTip(tipCents)
        setShowWarning(true)
        return
      }
      setSelectedTip(tipCents)
      onSelect(tipCents)
    },
    [isTipExcessive, onSelect]
  )

  const handleWarningConfirm = useCallback(() => {
    if (pendingTip !== null) {
      setSelectedTip(pendingTip)
      onSelect(pendingTip)
      setShowWarning(false)
      setPendingTip(null)
    }
  }, [pendingTip, onSelect])

  const handleWarningCancel = useCallback(() => {
    setShowWarning(false)
    setPendingTip(null)
  }, [])

  const handlePercentage = useCallback(
    (pct: number) => {
      const tipCents = Math.round((subtotalCents * pct) / 100)
      setCustomMode(false)
      confirmTip(tipCents)
    },
    [subtotalCents, confirmTip]
  )

  const handleNoTip = useCallback(() => {
    setSelectedTip(0)
    setCustomMode(false)
    onSelect(0)
  }, [onSelect])

  const handleCustomKey = useCallback((key: string) => {
    if (key === 'C') {
      setCustomInput('')
      return
    }
    setCustomInput((prev) => {
      const next = prev + key
      if (parseInt(next, 10) > 9999999) return prev
      return next
    })
  }, [])

  const handleCustomConfirm = useCallback(() => {
    confirmTip(customCents)
  }, [customCents, confirmTip])

  // Tip suggestion data with calculated amounts
  const tipSuggestions = useMemo(
    () =>
      tipPercentages.map((pct) => ({
        pct,
        cents: Math.round((subtotalCents * pct) / 100),
      })),
    [tipPercentages, subtotalCents]
  )

  // Warning overlay
  if (showWarning && pendingTip !== null) {
    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-amber-50">
          <AlertTriangle className="size-8 text-amber-600" />
        </div>
        <h2 className="text-center text-xl font-bold text-foreground">High Tip Warning</h2>
        <p className="text-center text-sm text-muted-foreground">
          This tip of <MoneyDisplay cents={pendingTip} className="inline font-semibold text-foreground" />{' '}
          exceeds 50% of the check total. Are you sure?
        </p>
        <div className="rounded-xl bg-secondary p-4 text-center">
          <p className="text-sm text-muted-foreground">New Total</p>
          <MoneyDisplay
            cents={displayTotal + pendingTip}
            className="text-2xl font-bold text-foreground"
          />
        </div>
        <div className="flex w-full gap-3">
          <button
            onClick={handleWarningCancel}
            className="btn-press touch-target-lg flex-1 rounded-xl bg-secondary py-3 text-sm font-semibold text-foreground"
          >
            Go Back
          </button>
          <button
            onClick={handleWarningConfirm}
            className="btn-press touch-target-lg flex-1 rounded-xl bg-amber-500 py-3 text-sm font-bold text-white"
          >
            Confirm Tip
          </button>
        </div>
      </div>
    )
  }

  // Custom amount / post-auth tip entry
  if (customMode) {
    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-center text-xl font-bold text-foreground">
          {postAuthMode ? 'Enter Tip from Receipt' : 'Custom Tip'}
        </h2>

        {postAuthMode && (
          <p className="text-center text-sm text-muted-foreground">
            Enter the exact dollar amount from the signed receipt
          </p>
        )}

        <div className="rounded-xl bg-secondary p-4 text-center">
          <p className="text-sm text-muted-foreground">Tip Amount</p>
          <MoneyDisplay
            cents={customCents}
            className={cn(
              'text-4xl font-bold',
              customCents > 0 ? 'text-foreground' : 'text-muted-foreground'
            )}
          />
        </div>

        <div className="text-center text-sm text-muted-foreground">
          New Total:{' '}
          <MoneyDisplay
            cents={displayTotal + customCents}
            className="font-semibold text-foreground"
          />
        </div>

        {/* Excessive tip indicator */}
        {customCents > 0 && isTipExcessive(customCents) && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>Tip exceeds 50% of check total</span>
          </div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2">
          {NUMPAD_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => handleCustomKey(key)}
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

        <div className="flex gap-3">
          {!postAuthMode && (
            <button
              onClick={() => setCustomMode(false)}
              className="btn-press touch-target-lg flex-1 rounded-xl bg-secondary py-3 text-sm font-semibold text-foreground"
            >
              Back
            </button>
          )}
          <button
            onClick={handleCustomConfirm}
            disabled={customCents <= 0}
            className={cn(
              'btn-press touch-target-lg flex-1 rounded-xl py-3 text-sm font-bold transition-all',
              customCents > 0
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'cursor-not-allowed bg-muted text-muted-foreground'
            )}
          >
            Confirm Tip
          </button>
        </div>

        {/* Adjustment window notice */}
        <p className="text-center text-xs text-muted-foreground">
          Tips can be adjusted within 24 hours
        </p>
      </div>
    )
  }

  // Standard tip selection screen
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-center text-xl font-bold text-foreground">Add Tip?</h2>

      {/* Tip percentage on pre-tax subtotal notice */}
      <p className="text-center text-xs text-muted-foreground">
        Percentages calculated on pre-tax subtotal
      </p>

      {/* Suggested percentages */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tipSuggestions.map(({ pct, cents }) => {
          const isSelected = selectedTip === cents
          return (
            <button
              key={pct}
              onClick={() => handlePercentage(pct)}
              className={cn(
                'btn-press touch-target-lg flex flex-col items-center gap-1 rounded-xl py-5 transition-all',
                isSelected
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary shadow-warm-md'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              )}
            >
              <span className="text-2xl font-bold">{pct}%</span>
              <MoneyDisplay cents={cents} className="text-sm opacity-80" />
            </button>
          )
        })}
      </div>

      {/* Custom + No Tip row */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setCustomMode(true)}
          className="btn-press touch-target-lg rounded-xl bg-accent py-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/80"
        >
          Custom Amount
        </button>
        <button
          onClick={handleNoTip}
          className={cn(
            'btn-press touch-target-lg rounded-xl py-4 text-sm font-semibold transition-colors',
            selectedTip === 0
              ? 'bg-muted text-foreground ring-2 ring-border'
              : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
          )}
        >
          No Tip
        </button>
      </div>

      {/* Running total */}
      {selectedTip !== null && (
        <div className="animate-slide-in-right rounded-xl bg-muted p-4 text-center">
          <p className="text-sm text-muted-foreground">Total with Tip</p>
          <MoneyDisplay
            cents={displayTotal + selectedTip}
            className="text-2xl font-bold text-foreground"
          />
        </div>
      )}

      {/* Adjustment window notice */}
      <p className="text-center text-xs text-muted-foreground">
        Tips can be adjusted within 24 hours
      </p>
    </div>
  )
}
