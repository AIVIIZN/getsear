'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { CreditCard, Check, X, Loader2, AlertTriangle } from 'lucide-react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { cn } from '@/lib/utils'

type CardState =
  | 'idle'
  | 'preparing'
  | 'waiting_for_card'
  | 'processing'
  | 'approved'
  | 'declined'
  | 'timeout'

interface CardProcessingProps {
  totalCents: number
  orderId: string
  locationId: string
  /** 'sale' = auth+capture, 'auth_only' = pre-auth for tip-on-receipt */
  mode?: 'sale' | 'auth_only'
  /** If set, allows user to enter a custom amount (for partial/multi-tender) */
  allowPartial?: boolean
  tipCents?: number
  onApproved: (result: {
    cardLastFour: string
    authCode: string
    cardBrand: string
    paymentId: string
    transactionId: string
  }) => void
  onDeclined: (reason: string) => void
  onCancel: () => void
}

const TIMEOUT_MS = 120_000 // 120 seconds
const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', 'C']

export function CardProcessing({
  totalCents,
  orderId,
  locationId,
  mode = 'sale',
  allowPartial = false,
  tipCents = 0,
  onApproved,
  onDeclined,
  onCancel,
}: CardProcessingProps) {
  const [state, setState] = useState<CardState>('idle')
  const [chargeAmountCents, setChargeAmountCents] = useState(totalCents)
  const [customInput, setCustomInput] = useState('')
  const [showCustomAmount, setShowCustomAmount] = useState(false)
  const [result, setResult] = useState<{
    cardLastFour?: string
    authCode?: string
    cardBrand?: string
    declineReason?: string
  }>({})
  const controllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startProcessing = useCallback(async () => {
    controllerRef.current = new AbortController()

    setState('preparing')

    // Start timeout timer
    timeoutRef.current = setTimeout(() => {
      setState('timeout')
      controllerRef.current?.abort()
    }, TIMEOUT_MS)

    // Brief delay to show "Preparing terminal..." state
    await new Promise((r) => setTimeout(r, 800))
    if (controllerRef.current.signal.aborted) return

    setState('waiting_for_card')

    // Short delay simulating terminal activation
    await new Promise((r) => setTimeout(r, 500))
    if (controllerRef.current.signal.aborted) return

    setState('processing')

    try {
      const res = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controllerRef.current.signal,
        body: JSON.stringify({
          order_id: orderId,
          location_id: locationId,
          payment_method: 'credit_card',
          amount_cents: chargeAmountCents,
          tip_cents: tipCents,
          mode,
        }),
      })

      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      const json = await res.json()

      if (res.ok) {
        setState('approved')
        setResult({
          cardLastFour: json.data?.card_last_four ?? '',
          authCode: json.data?.auth_code ?? '',
          cardBrand: json.data?.card_brand ?? '',
        })
        // Brief pause so user sees the approval, then callback
        setTimeout(() => {
          onApproved({
            cardLastFour: json.data?.card_last_four ?? '',
            authCode: json.data?.auth_code ?? '',
            cardBrand: json.data?.card_brand ?? '',
            paymentId: json.data?.id ?? '',
            transactionId: json.data?.processor_transaction_id ?? '',
          })
        }, 1500)
      } else if (res.status === 402) {
        setState('declined')
        const reason = json.reason ?? json.error ?? 'Card declined'
        setResult({ declineReason: reason })
      } else {
        setState('declined')
        setResult({ declineReason: json.error ?? 'Processing error' })
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setState('declined')
      setResult({ declineReason: 'Network error — check connection' })
    }
  }, [chargeAmountCents, orderId, locationId, mode, tipCents, onApproved])

  // Auto-start processing unless in partial payment mode
  useEffect(() => {
    if (!allowPartial || !showCustomAmount) {
      startProcessing()
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      controllerRef.current?.abort()
    }
  // We only want to auto-start once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRetry = useCallback(() => {
    setResult({})
    startProcessing()
  }, [startProcessing])

  const handleTryAnotherCard = useCallback(() => {
    setResult({})
    setState('idle')
    // Give a moment, then restart
    setTimeout(() => startProcessing(), 300)
  }, [startProcessing])

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

  const handleConfirmCustomAmount = useCallback(() => {
    const cents = parseInt(customInput, 10) || 0
    if (cents > 0 && cents <= totalCents) {
      setChargeAmountCents(cents)
      setShowCustomAmount(false)
      // Start processing after setting amount
      setTimeout(() => startProcessing(), 100)
    }
  }, [customInput, totalCents, startProcessing])

  // Partial amount entry screen
  if (allowPartial && showCustomAmount) {
    const customCents = parseInt(customInput, 10) || 0
    const isValidAmount = customCents > 0 && customCents <= totalCents

    return (
      <div className="flex flex-col items-center gap-5 py-8">
        <h2 className="text-xl font-bold text-foreground">Charge Amount</h2>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">Total Due</p>
          <MoneyDisplay cents={totalCents} className="text-lg font-semibold text-foreground" />
        </div>

        <div className="w-full max-w-xs rounded-xl bg-secondary p-4 text-center">
          <p className="text-sm text-muted-foreground">Amount to Charge</p>
          <MoneyDisplay
            cents={customCents}
            className={cn('text-4xl font-bold', customCents > 0 ? 'text-foreground' : 'text-muted-foreground')}
          />
        </div>

        <div className="grid w-full max-w-xs grid-cols-3 gap-2">
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

        <div className="flex w-full max-w-xs gap-3">
          <button
            onClick={() => setShowCustomAmount(false)}
            className="btn-press touch-target-lg flex-1 rounded-xl bg-secondary py-3 text-sm font-semibold text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmCustomAmount}
            disabled={!isValidAmount}
            className={cn(
              'btn-press touch-target-lg flex-1 rounded-xl py-3 text-sm font-bold transition-all',
              isValidAmount
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'cursor-not-allowed bg-muted text-muted-foreground'
            )}
          >
            Charge {isValidAmount ? <MoneyDisplay cents={customCents} className="inline" /> : null}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      {/* Amount */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {mode === 'auth_only' ? 'Authorizing' : 'Charging'}
        </p>
        <MoneyDisplay cents={chargeAmountCents + tipCents} className="text-3xl font-bold text-foreground" />
        {tipCents > 0 && (
          <p className="text-xs text-muted-foreground">
            (includes <MoneyDisplay cents={tipCents} className="inline text-xs" /> tip)
          </p>
        )}
      </div>

      {/* Terminal illustration / status icon */}
      <div
        className={cn(
          'flex size-28 items-center justify-center rounded-full transition-all duration-500',
          state === 'idle' && 'bg-secondary',
          state === 'preparing' && 'bg-blue-50',
          state === 'waiting_for_card' && 'bg-blue-50 animate-pulse',
          state === 'processing' && 'bg-blue-50',
          state === 'approved' && 'bg-green-50',
          state === 'declined' && 'bg-red-50',
          state === 'timeout' && 'bg-amber-50'
        )}
      >
        {(state === 'idle' || state === 'preparing') && (
          <Loader2 className="size-12 animate-spin text-blue-600" />
        )}
        {state === 'waiting_for_card' && (
          <CreditCard className="size-12 text-blue-600" />
        )}
        {state === 'processing' && (
          <Loader2 className="size-12 animate-spin text-blue-600" />
        )}
        {state === 'approved' && (
          <Check className="size-12 text-green-600" strokeWidth={3} />
        )}
        {state === 'declined' && (
          <X className="size-12 text-red-600" strokeWidth={3} />
        )}
        {state === 'timeout' && (
          <AlertTriangle className="size-12 text-amber-600" />
        )}
      </div>

      {/* Status text */}
      <div className="text-center">
        {state === 'idle' && (
          <p className="text-lg font-semibold text-muted-foreground">Initializing...</p>
        )}
        {state === 'preparing' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-semibold text-blue-600">Preparing terminal...</p>
            <p className="text-sm text-muted-foreground">Connecting to payment terminal</p>
          </div>
        )}
        {state === 'waiting_for_card' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-semibold text-blue-600">Present Card on Terminal</p>
            <p className="text-sm text-muted-foreground">
              Tap, insert, or swipe card
            </p>
            {/* Animated dots */}
            <div className="flex gap-1.5 pt-2">
              <div className="size-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '0ms' }} />
              <div className="size-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '150ms' }} />
              <div className="size-2 animate-bounce rounded-full bg-blue-400" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        {state === 'processing' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-semibold text-blue-600">Authorizing...</p>
            <p className="text-sm text-muted-foreground">Processing payment</p>
          </div>
        )}
        {state === 'approved' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg font-bold text-green-600">Approved</p>
            {result.cardBrand && result.cardLastFour && (
              <p className="text-sm text-muted-foreground">
                {result.cardBrand.toUpperCase()} ****{result.cardLastFour}
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
          <div className="flex flex-col items-center gap-3">
            <p className="text-lg font-bold text-red-600">Declined</p>
            <p className="text-sm text-muted-foreground">{result.declineReason}</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleRetry}
                className="btn-press touch-target-lg rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Try Again
              </button>
              <button
                onClick={handleTryAnotherCard}
                className="btn-press touch-target-lg rounded-xl bg-secondary px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80"
              >
                Try Another Card
              </button>
            </div>
          </div>
        )}
        {state === 'timeout' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-lg font-bold text-amber-600">Terminal Not Responding</p>
            <p className="text-sm text-muted-foreground">
              The payment terminal did not respond. Check that the terminal is powered on and connected.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleRetry}
                className="btn-press touch-target-lg rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Retry
              </button>
              <button
                onClick={onCancel}
                className="btn-press touch-target-lg rounded-xl bg-secondary px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel button (visible during processing states) */}
      {(state === 'preparing' || state === 'waiting_for_card' || state === 'processing') && (
        <button
          onClick={onCancel}
          className="btn-press touch-target-lg rounded-xl bg-secondary px-8 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/80"
        >
          Cancel
        </button>
      )}

      {/* Partial payment option */}
      {allowPartial && (state === 'idle' || state === 'declined' || state === 'timeout') && (
        <button
          onClick={() => setShowCustomAmount(true)}
          className="text-sm font-medium text-primary underline underline-offset-2"
        >
          Enter custom charge amount
        </button>
      )}
    </div>
  )
}
