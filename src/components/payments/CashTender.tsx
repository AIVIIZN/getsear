'use client'

import { useState, useCallback } from 'react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { cn } from '@/lib/utils'

interface CashTenderProps {
  totalCents: number
  onComplete: (tenderedCents: number) => void
}

const QUICK_AMOUNTS = [
  { label: 'Exact', cents: 0 },
  { label: '$20', cents: 2000 },
  { label: '$50', cents: 5000 },
  { label: '$100', cents: 10000 },
]

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', 'C']

export function CashTender({ totalCents, onComplete }: CashTenderProps) {
  const [inputStr, setInputStr] = useState('')

  // Input is in cents (no decimal point needed)
  const tenderedCents = inputStr ? parseInt(inputStr, 10) : 0
  const changeDueCents = Math.max(0, tenderedCents - totalCents)
  const isValid = tenderedCents >= totalCents

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
        // Exact change
        onComplete(totalCents)
      } else {
        setInputStr(String(cents))
      }
    },
    [totalCents, onComplete]
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Total due */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Total Due</p>
        <MoneyDisplay cents={totalCents} className="text-3xl font-bold text-foreground" />
      </div>

      {/* Cash tendered display */}
      <div className="rounded-xl bg-secondary p-4 text-center">
        <p className="text-sm text-muted-foreground">Cash Tendered</p>
        <MoneyDisplay
          cents={tenderedCents}
          className={cn('text-4xl font-bold', tenderedCents > 0 ? 'text-foreground' : 'text-muted-foreground')}
        />
      </div>

      {/* Change due */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Change Due</p>
        <MoneyDisplay
          cents={changeDueCents}
          className={cn('text-2xl font-bold', isValid ? 'text-success' : 'text-muted-foreground')}
        />
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
            {qa.label}
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

      {/* Complete button */}
      <button
        onClick={() => onComplete(tenderedCents)}
        disabled={!isValid}
        className={cn(
          'btn-press touch-target-lg w-full rounded-xl py-4 text-lg font-bold transition-all',
          isValid
            ? 'bg-success text-white hover:bg-success/90'
            : 'cursor-not-allowed bg-muted text-muted-foreground'
        )}
      >
        Complete Cash Payment
      </button>
    </div>
  )
}
