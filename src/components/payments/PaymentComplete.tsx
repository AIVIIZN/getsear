'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { cn } from '@/lib/utils'

interface PaymentCompleteProps {
  totalCents: number
  tipCents: number
  paymentMethod: string
  cardLastFour?: string
  changeDueCents?: number
  onDone: () => void
  autoRedirectMs?: number
}

export function PaymentComplete({
  totalCents,
  tipCents,
  paymentMethod,
  cardLastFour,
  changeDueCents,
  onDone,
  autoRedirectMs = 3000,
}: PaymentCompleteProps) {
  const [showCheck, setShowCheck] = useState(false)
  const [countdown, setCountdown] = useState(Math.ceil(autoRedirectMs / 1000))

  // Animate checkmark in
  useEffect(() => {
    const timer = setTimeout(() => setShowCheck(true), 200)
    return () => clearTimeout(timer)
  }, [])

  // Auto-redirect countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          onDone()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onDone, autoRedirectMs])

  const methodLabel =
    paymentMethod === 'credit_card' || paymentMethod === 'debit_card'
      ? `Card${cardLastFour ? ` ****${cardLastFour}` : ''}`
      : paymentMethod === 'cash'
        ? 'Cash'
        : paymentMethod === 'gift_card'
          ? 'Gift Card'
          : paymentMethod === 'apple_pay' || paymentMethod === 'google_pay'
            ? 'Digital Wallet'
            : 'Payment'

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Animated checkmark */}
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-success/10 transition-all duration-500',
          showCheck ? 'size-24 scale-100 opacity-100' : 'size-0 scale-50 opacity-0'
        )}
      >
        <Check
          className={cn(
            'text-success transition-all duration-300 delay-300',
            showCheck ? 'size-12 opacity-100' : 'size-0 opacity-0'
          )}
          strokeWidth={3}
        />
      </div>

      <h2
        className={cn(
          'text-2xl font-bold text-success transition-opacity duration-500 delay-500',
          showCheck ? 'opacity-100' : 'opacity-0'
        )}
      >
        Payment Complete
      </h2>

      {/* Summary */}
      <div
        className={cn(
          'w-full max-w-xs space-y-3 rounded-xl bg-secondary p-5 transition-all duration-500 delay-700',
          showCheck ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Method</span>
          <span className="text-sm font-semibold">{methodLabel}</span>
        </div>

        {tipCents > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tip</span>
            <MoneyDisplay cents={tipCents} className="text-sm font-semibold" />
          </div>
        )}

        <div className="border-t border-border pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <MoneyDisplay cents={totalCents + tipCents} className="text-lg font-bold text-foreground" />
          </div>
        </div>

        {changeDueCents !== undefined && changeDueCents > 0 && (
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-sm text-muted-foreground">Change Due</span>
            <MoneyDisplay cents={changeDueCents} className="text-sm font-bold text-success" />
          </div>
        )}
      </div>

      {/* Auto-redirect info */}
      <p className="text-sm text-muted-foreground">
        Returning to orders in {countdown}s...
      </p>

      <button
        onClick={onDone}
        className="btn-press touch-target-lg rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Done
      </button>
    </div>
  )
}
