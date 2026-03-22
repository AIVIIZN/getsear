'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Check, X } from 'lucide-react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { cn } from '@/lib/utils'

type CardState = 'waiting' | 'processing' | 'approved' | 'declined'

interface CardProcessingProps {
  totalCents: number
  onApproved: (result: { cardLastFour: string; authCode: string; cardBrand: string }) => void
  onDeclined: (reason: string) => void
}

export function CardProcessing({ totalCents, onApproved, onDeclined }: CardProcessingProps) {
  const [state, setState] = useState<CardState>('waiting')
  const [result, setResult] = useState<{
    cardLastFour?: string
    authCode?: string
    cardBrand?: string
    declineReason?: string
  }>({})

  useEffect(() => {
    // Simulate card processing via API
    const controller = new AbortController()

    async function processCard() {
      setState('processing')

      try {
        const res = await fetch('/api/payments/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            // These will be filled by the parent via searchParams or store
            order_id: new URLSearchParams(window.location.search).get('order_id') ?? '',
            location_id: new URLSearchParams(window.location.search).get('location_id') ?? '',
            payment_method: 'credit_card',
            amount_cents: totalCents,
            tip_cents: 0,
          }),
        })

        const json = await res.json()

        if (res.ok) {
          setState('approved')
          setResult({
            cardLastFour: json.data?.card_last_four ?? '4242',
            authCode: json.data?.reference_number ?? 'A1B2C3',
            cardBrand: json.data?.card_brand ?? 'visa',
          })
          // Wait a moment for the user to see "Approved" then proceed
          setTimeout(() => {
            onApproved({
              cardLastFour: json.data?.card_last_four ?? '4242',
              authCode: json.data?.reference_number ?? 'A1B2C3',
              cardBrand: json.data?.card_brand ?? 'visa',
            })
          }, 1500)
        } else if (res.status === 402) {
          setState('declined')
          const reason = json.reason ?? 'Card declined'
          setResult({ declineReason: reason })
          setTimeout(() => onDeclined(reason), 2000)
        } else {
          setState('declined')
          setResult({ declineReason: json.error ?? 'Processing error' })
          setTimeout(() => onDeclined(json.error ?? 'Processing error'), 2000)
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setState('declined')
        setResult({ declineReason: 'Network error' })
        setTimeout(() => onDeclined('Network error'), 2000)
      }
    }

    // Short delay before starting to simulate "Present Card" prompt
    const timer = setTimeout(processCard, 800)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [totalCents, onApproved, onDeclined])

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      {/* Amount */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Charging</p>
        <MoneyDisplay cents={totalCents} className="text-3xl font-bold text-foreground" />
      </div>

      {/* Card icon with animation */}
      <div
        className={cn(
          'flex size-28 items-center justify-center rounded-full transition-all duration-500',
          state === 'waiting' && 'bg-blue-50 animate-pulse-attention',
          state === 'processing' && 'bg-blue-50',
          state === 'approved' && 'bg-success/10',
          state === 'declined' && 'bg-error/10'
        )}
      >
        {(state === 'waiting' || state === 'processing') && (
          <CreditCard className="size-12 text-blue-600" />
        )}
        {state === 'approved' && (
          <Check className="size-12 text-success" strokeWidth={3} />
        )}
        {state === 'declined' && (
          <X className="size-12 text-error" strokeWidth={3} />
        )}
      </div>

      {/* Status text */}
      <div className="text-center">
        {state === 'waiting' && (
          <p className="text-lg font-semibold text-blue-600">Present Card on Terminal</p>
        )}
        {state === 'processing' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-lg font-semibold text-blue-600">Processing...</p>
            {/* Spinner */}
            <div className="size-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
          </div>
        )}
        {state === 'approved' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-bold text-success">Approved</p>
            {result.cardLastFour && (
              <p className="text-sm text-muted-foreground">
                {result.cardBrand?.toUpperCase()} ****{result.cardLastFour}
              </p>
            )}
            {result.authCode && (
              <p className="font-mono text-xs text-muted-foreground">
                Auth: {result.authCode}
              </p>
            )}
          </div>
        )}
        {state === 'declined' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-bold text-error">Declined</p>
            <p className="text-sm text-muted-foreground">{result.declineReason}</p>
          </div>
        )}
      </div>
    </div>
  )
}
