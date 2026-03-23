'use client'

import { useState, useCallback } from 'react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { cn } from '@/lib/utils'
import { Gift, Search, Check, AlertTriangle } from 'lucide-react'

type GiftCardState = 'enter_number' | 'checking' | 'balance_shown' | 'processing' | 'complete' | 'error'

interface GiftCardFlowProps {
  totalCents: number
  orderId: string
  locationId: string
  onComplete: (result: { amountAppliedCents: number; remainingBalanceCents: number; cardNumber: string }) => void
  onCancel: () => void
}

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', 'C']

export function GiftCardFlow({ totalCents, orderId, locationId, onComplete, onCancel }: GiftCardFlowProps) {
  const [state, setState] = useState<GiftCardState>('enter_number')
  const [cardNumber, setCardNumber] = useState('')
  const [balanceCents, setBalanceCents] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleKey = useCallback((key: string) => {
    if (key === 'C') {
      setCardNumber('')
      return
    }
    setCardNumber((prev) => {
      if (prev.length >= 16) return prev
      return prev + key
    })
  }, [])

  // Format card number for display
  const formattedCardNumber = cardNumber.replace(/(.{4})/g, '$1 ').trim()

  // Check balance
  const handleCheckBalance = useCallback(async () => {
    if (cardNumber.length < 4) return
    setState('checking')
    setError(null)

    try {
      const res = await fetch(`/api/payments/gift-cards/${cardNumber}/balance`)
      if (res.ok) {
        const json = await res.json()
        const balance = json.data?.current_balance
          ? Math.round(parseFloat(json.data.current_balance) * 100)
          : 0
        setBalanceCents(balance)
        setState('balance_shown')
      } else {
        const json = await res.json().catch(() => ({ error: 'Card not found' }))
        setError(json.error ?? 'Card not found')
        setState('error')
      }
    } catch {
      setError('Network error')
      setState('error')
    }
  }, [cardNumber])

  // Process redemption
  const handleRedeem = useCallback(async () => {
    setState('processing')

    const amountToApply = Math.min(balanceCents, totalCents)

    try {
      const res = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          location_id: locationId,
          payment_method: 'gift_card',
          amount_cents: amountToApply,
          card_number: cardNumber,
        }),
      })

      if (res.ok) {
        setState('complete')
        onComplete({
          amountAppliedCents: amountToApply,
          remainingBalanceCents: Math.max(0, balanceCents - amountToApply),
          cardNumber,
        })
      } else {
        const json = await res.json().catch(() => ({ error: 'Payment failed' }))
        setError(json.error ?? 'Failed to process gift card')
        setState('error')
      }
    } catch {
      setError('Network error')
      setState('error')
    }
  }, [balanceCents, totalCents, orderId, locationId, cardNumber, onComplete])

  const coversTotal = balanceCents >= totalCents
  const amountToApply = Math.min(balanceCents, totalCents)
  const remainingOnCard = Math.max(0, balanceCents - totalCents)
  const remainingOnOrder = Math.max(0, totalCents - balanceCents)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-purple-50">
          <Gift className="h-7 w-7 text-purple-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Gift Card</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Amount due: <MoneyDisplay cents={totalCents} className="font-semibold text-foreground" />
        </p>
      </div>

      {/* Enter card number */}
      {(state === 'enter_number' || state === 'error') && (
        <>
          <div className="rounded-xl bg-[var(--secondary)] p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Card Number</p>
            <p className={cn(
              'text-2xl font-bold font-mono tracking-wider',
              cardNumber ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {formattedCardNumber || '---- ---- ---- ----'}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--error-bg)] p-3 text-sm text-[var(--error)]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {NUMPAD_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => handleKey(key)}
                className={cn(
                  'btn-press touch-target-lg rounded-lg py-3.5 text-lg font-semibold transition-colors',
                  key === 'C'
                    ? 'bg-[var(--error-bg)] text-[var(--error)] hover:bg-red-100'
                    : 'bg-[var(--secondary)] text-foreground hover:bg-[var(--muted)]'
                )}
              >
                {key}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="btn-press touch-target-lg flex-1 rounded-xl bg-[var(--secondary)] py-3.5 text-sm font-semibold text-muted-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleCheckBalance}
              disabled={cardNumber.length < 4}
              className="btn-press touch-target-lg flex-1 flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              <Search className="h-4 w-4" />
              Check Balance
            </button>
          </div>
        </>
      )}

      {/* Checking balance spinner */}
      {state === 'checking' && (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-purple-200 border-t-purple-600" />
          <p className="text-sm text-muted-foreground">Checking balance...</p>
        </div>
      )}

      {/* Balance shown */}
      {state === 'balance_shown' && (
        <>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 text-center">
            <p className="text-sm text-purple-600 font-medium">Card Balance</p>
            <MoneyDisplay cents={balanceCents} className="text-3xl font-bold text-purple-700" />
          </div>

          <div className="space-y-2 rounded-xl bg-[var(--secondary)] p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order Total</span>
              <MoneyDisplay cents={totalCents} className="font-medium" />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Apply from Card</span>
              <MoneyDisplay cents={amountToApply} className="font-semibold text-purple-700" />
            </div>
            {!coversTotal && (
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                <span className="text-[var(--warning)] font-medium">Remaining Balance Due</span>
                <MoneyDisplay cents={remainingOnOrder} className="font-bold text-[var(--warning)]" />
              </div>
            )}
            {coversTotal && remainingOnCard > 0 && (
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground">Remaining on Card</span>
                <MoneyDisplay cents={remainingOnCard} className="font-medium" />
              </div>
            )}
          </div>

          {!coversTotal && (
            <p className="text-xs text-center text-[var(--warning)] font-medium">
              Card doesn&apos;t cover the full amount. You&apos;ll need to pay the remaining with another method.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="btn-press touch-target-lg flex-1 rounded-xl bg-[var(--secondary)] py-3.5 text-sm font-semibold text-muted-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleRedeem}
              className="btn-press touch-target-lg flex-1 flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-3.5 text-sm font-bold text-white"
            >
              <Check className="h-4 w-4" />
              {coversTotal ? 'Pay Full Amount' : `Apply ${(amountToApply / 100).toFixed(2)}`}
            </button>
          </div>
        </>
      )}

      {/* Processing */}
      {state === 'processing' && (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-purple-200 border-t-purple-600" />
          <p className="text-sm text-muted-foreground">Processing payment...</p>
        </div>
      )}
    </div>
  )
}
