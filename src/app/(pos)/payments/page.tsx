'use client'

import { useState, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { PaymentMethodGrid, type PaymentMethodChoice } from '@/components/payments/PaymentMethodGrid'
import { CashTender } from '@/components/payments/CashTender'
import { TipSelector } from '@/components/payments/TipSelector'
import { ReceiptOptions, type ReceiptChoice } from '@/components/payments/ReceiptOptions'
import { PaymentComplete } from '@/components/payments/PaymentComplete'
import { CardProcessing } from '@/components/payments/CardProcessing'
import { useOrderStore } from '@/stores/order-store'
import { cn } from '@/lib/utils'

type FlowState =
  | 'method_select'
  | 'processing_card'
  | 'processing_cash'
  | 'tip_prompt'
  | 'receipt_prompt'
  | 'complete'

interface PaymentResult {
  method: string
  amountCents: number
  tipCents: number
  cardLastFour?: string
  authCode?: string
  cardBrand?: string
  changeDueCents?: number
  paymentId?: string
}

export default function PaymentsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-[var(--primary)] border-t-transparent rounded-full" /></div>}>
      <PaymentsPage />
    </Suspense>
  )
}

function PaymentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentOrder = useOrderStore((s) => s.currentOrder)

  // Allow overriding total via query param for testing
  const paramTotal = searchParams.get('total_cents')
  const orderTotalCents = paramTotal
    ? parseInt(paramTotal, 10)
    : currentOrder?.total_cents ?? 0

  const orderId = searchParams.get('order_id') ?? currentOrder?.id ?? ''
  const locationId = searchParams.get('location_id') ?? ''

  const [flowState, setFlowState] = useState<FlowState>('method_select')
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodChoice | null>(null)
  const [paymentResult, setPaymentResult] = useState<PaymentResult>({
    method: '',
    amountCents: 0,
    tipCents: 0,
  })

  // Determine if tip prompt should be shown (card payments)
  const shouldShowTip = useMemo(() => {
    return selectedMethod === 'credit_card' || selectedMethod === 'digital_wallet'
  }, [selectedMethod])

  // -- Handlers --

  const handleMethodSelect = useCallback(
    (method: PaymentMethodChoice) => {
      setSelectedMethod(method)
      setPaymentResult((prev) => ({ ...prev, method, amountCents: orderTotalCents }))

      if (method === 'credit_card' || method === 'digital_wallet') {
        setFlowState('processing_card')
      } else if (method === 'cash') {
        setFlowState('processing_cash')
      } else if (method === 'gift_card') {
        // For gift card, process directly then move to receipt
        processGiftCard()
      } else if (method === 'split') {
        // Split payment is a more complex flow -- for now, go back
        router.push('/checks')
      } else {
        // house_account — process and go to receipt
        processGenericPayment(method)
      }
    },
    [orderTotalCents, orderId, locationId, router]
  )

  const processGiftCard = useCallback(async () => {
    // Simplified: go straight to tip (no tip for gift card) then receipt
    setPaymentResult((prev) => ({
      ...prev,
      method: 'gift_card',
      amountCents: orderTotalCents,
      tipCents: 0,
    }))
    setFlowState('receipt_prompt')
  }, [orderTotalCents])

  const processGenericPayment = useCallback(
    async (method: string) => {
      setPaymentResult((prev) => ({
        ...prev,
        method,
        amountCents: orderTotalCents,
        tipCents: 0,
      }))
      setFlowState('receipt_prompt')
    },
    [orderTotalCents]
  )

  const handleCardApproved = useCallback(
    (result: { cardLastFour: string; authCode: string; cardBrand: string; paymentId: string }) => {
      setPaymentResult((prev) => ({
        ...prev,
        cardLastFour: result.cardLastFour,
        authCode: result.authCode,
        cardBrand: result.cardBrand,
        paymentId: result.paymentId,
      }))
      if (shouldShowTip) {
        setFlowState('tip_prompt')
      } else {
        setFlowState('receipt_prompt')
      }
    },
    [shouldShowTip]
  )

  const handleCardDeclined = useCallback(() => {
    // Go back to method select on decline
    setFlowState('method_select')
    setSelectedMethod(null)
  }, [])

  const handleCashComplete = useCallback(
    async (tenderedCents: number) => {
      const changeDue = Math.max(0, tenderedCents - orderTotalCents)

      // Process cash payment via API
      try {
        await fetch('/api/payments/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
            location_id: locationId,
            payment_method: 'cash',
            amount_cents: orderTotalCents,
            tip_cents: 0,
            cash_tendered_cents: tenderedCents,
          }),
        })
      } catch {
        // Continue even if API fails in dev
      }

      setPaymentResult((prev) => ({
        ...prev,
        changeDueCents: changeDue,
      }))
      setFlowState('receipt_prompt')
    },
    [orderTotalCents, orderId, locationId]
  )

  const handleTipSelected = useCallback(
    async (tipCents: number) => {
      setPaymentResult((prev) => ({ ...prev, tipCents }))

      // If card payment, adjust the tip via API using the actual payment_id
      if (tipCents > 0 && paymentResult.paymentId) {
        try {
          await fetch('/api/payments/tip-adjust', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payment_id: paymentResult.paymentId,
              new_tip_cents: tipCents,
            }),
          })
        } catch {
          // Continue even if API fails in dev
        }
      }

      setFlowState('receipt_prompt')
    },
    [paymentResult.paymentId]
  )

  const handleReceiptChoice = useCallback((_choice: ReceiptChoice) => {
    // In production: trigger print/email/SMS here
    setFlowState('complete')
  }, [])

  const handleDone = useCallback(() => {
    router.push('/orders')
  }, [router])

  const handleBack = useCallback(() => {
    if (flowState === 'method_select') {
      router.push('/orders')
    } else {
      setFlowState('method_select')
      setSelectedMethod(null)
    }
  }, [flowState, router])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      {flowState !== 'complete' && (
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button
            onClick={handleBack}
            className="btn-press touch-target flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {flowState === 'method_select' ? 'Back to Order' : 'Back'}
          </button>

          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">Order Total</p>
            <MoneyDisplay cents={orderTotalCents} className="text-xl font-bold text-foreground" />
          </div>
        </div>
      )}

      {/* Content area with smooth transitions */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-md">
          {/* METHOD SELECT */}
          <div
            className={cn(
              'transition-all duration-300',
              flowState === 'method_select'
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none absolute -translate-x-8 opacity-0'
            )}
          >
            {flowState === 'method_select' && (
              <div className="flex flex-col gap-6">
                <div className="text-center">
                  <MoneyDisplay
                    cents={orderTotalCents}
                    className="text-4xl font-bold text-foreground"
                  />
                  <p className="mt-1 text-sm text-muted-foreground">Select Payment Method</p>
                </div>
                <PaymentMethodGrid onSelect={handleMethodSelect} />
              </div>
            )}
          </div>

          {/* CARD PROCESSING */}
          <div
            className={cn(
              'transition-all duration-300',
              flowState === 'processing_card'
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none absolute translate-x-8 opacity-0'
            )}
          >
            {flowState === 'processing_card' && (
              <CardProcessing
                totalCents={orderTotalCents}
                onApproved={handleCardApproved}
                onDeclined={handleCardDeclined}
              />
            )}
          </div>

          {/* CASH PROCESSING */}
          <div
            className={cn(
              'transition-all duration-300',
              flowState === 'processing_cash'
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none absolute translate-x-8 opacity-0'
            )}
          >
            {flowState === 'processing_cash' && (
              <CashTender totalCents={orderTotalCents} onComplete={handleCashComplete} />
            )}
          </div>

          {/* TIP PROMPT */}
          <div
            className={cn(
              'transition-all duration-300',
              flowState === 'tip_prompt'
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none absolute translate-x-8 opacity-0'
            )}
          >
            {flowState === 'tip_prompt' && (
              <TipSelector subtotalCents={orderTotalCents} onSelect={handleTipSelected} />
            )}
          </div>

          {/* RECEIPT PROMPT */}
          <div
            className={cn(
              'transition-all duration-300',
              flowState === 'receipt_prompt'
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none absolute translate-x-8 opacity-0'
            )}
          >
            {flowState === 'receipt_prompt' && (
              <ReceiptOptions onSelect={handleReceiptChoice} />
            )}
          </div>

          {/* COMPLETE */}
          <div
            className={cn(
              'transition-all duration-500',
              flowState === 'complete'
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none absolute translate-y-8 opacity-0'
            )}
          >
            {flowState === 'complete' && (
              <PaymentComplete
                totalCents={paymentResult.amountCents}
                tipCents={paymentResult.tipCents}
                paymentMethod={paymentResult.method}
                cardLastFour={paymentResult.cardLastFour}
                changeDueCents={paymentResult.changeDueCents}
                onDone={handleDone}
                autoRedirectMs={3000}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
