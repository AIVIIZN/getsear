'use client'

import { useState, useCallback } from 'react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { TIP_SUGGESTIONS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface TipSelectorProps {
  subtotalCents: number
  onSelect: (tipCents: number) => void
}

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', 'C']

export function TipSelector({ subtotalCents, onSelect }: TipSelectorProps) {
  const [customMode, setCustomMode] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [selectedTip, setSelectedTip] = useState<number | null>(null)

  const customCents = customInput ? parseInt(customInput, 10) : 0

  const handlePercentage = useCallback(
    (pct: number) => {
      const tipCents = Math.round((subtotalCents * pct) / 100)
      setSelectedTip(tipCents)
      setCustomMode(false)
      onSelect(tipCents)
    },
    [subtotalCents, onSelect]
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
    setSelectedTip(customCents)
    onSelect(customCents)
  }, [customCents, onSelect])

  if (customMode) {
    return (
      <div className="flex flex-col gap-5">
        <h2 className="text-center text-xl font-bold text-foreground">Custom Tip</h2>

        <div className="rounded-xl bg-secondary p-4 text-center">
          <p className="text-sm text-muted-foreground">Tip Amount</p>
          <MoneyDisplay
            cents={customCents}
            className={cn('text-4xl font-bold', customCents > 0 ? 'text-foreground' : 'text-muted-foreground')}
          />
        </div>

        <div className="text-center text-sm text-muted-foreground">
          New Total: <MoneyDisplay cents={subtotalCents + customCents} className="font-semibold text-foreground" />
        </div>

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
          <button
            onClick={() => setCustomMode(false)}
            className="btn-press touch-target-lg flex-1 rounded-xl bg-secondary py-3 text-sm font-semibold text-foreground"
          >
            Back
          </button>
          <button
            onClick={handleCustomConfirm}
            className="btn-press touch-target-lg flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
          >
            Confirm Tip
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-center text-xl font-bold text-foreground">Add Tip?</h2>

      {/* Suggested percentages */}
      <div className="grid grid-cols-3 gap-3">
        {TIP_SUGGESTIONS.map((pct) => {
          const tipCents = Math.round((subtotalCents * pct) / 100)
          const isSelected = selectedTip === tipCents
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
              <MoneyDisplay cents={tipCents} className="text-sm opacity-80" />
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
            cents={subtotalCents + selectedTip}
            className="text-2xl font-bold text-foreground"
          />
        </div>
      )}
    </div>
  )
}
