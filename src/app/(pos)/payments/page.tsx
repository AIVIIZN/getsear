'use client'

import { useState, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui-v2/Button'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { PaymentMethodGrid, type PaymentMethodChoice } from '@/components/payments/PaymentMethodGrid'
import { CashTender } from '@/components/payments/CashTender'
import { TipSelector } from '@/components/payments/TipSelector'
import { ReceiptOptions, type ReceiptChoice } from '@/components/payments/ReceiptOptions'
import { PaymentComplete } from '@/components/payments/PaymentComplete'
import { CardProcessing } from '@/components/payments/CardProcessing'
import { GiftCardFlow } from '@/components/payments/GiftCardFlow'
import { HouseAccountFlow } from '@/components/payments/HouseAccountFlow'
import { useOrderStore } from '@/stores/order-store'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'

type FlowState =
  | 'method_select'
  | 'processing_card'
  | 'processing_cash'
  | 'processing_gift_card'
  | 'processing_house_account'
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

function PaymentsLoadingSkeleton() {
  return (
    <div className="flex h-full flex-col p-[var(--space-6)] gap-[var(--space-5)]">
      <Skeleton variant="text" lines={1} className="w-1/3" />
      <div className="mx-auto w-full max-w-md space-y-[var(--space-4)]">
        <Skeleton variant="text" lines={2} />
        <Skeleton variant="card" />
      </div>
    </div>
  )
}

export default function PaymentsPageWrapper() {
  return (
    <Suspense fallback={<PaymentsLoadingSkeleton />}>
      <PaymentsPage />
    </Suspense>
  )
}

function PaymentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentOrder = useOrderStore((s) => s.currentOrder)
  const { clearCurrentOrder } = useOrderStore((s) => s.actions)
  const activeLocationId = useAuthStore((s) => s.activeLocationId)

  const paramTotal = searchParams.get('total_cents')
  const orderTotalCents = paramTotal
    ? parseInt(paramTotal, 10)
    : currentOrder?.total_cents ?? 0

  const orderId = searchParams.get('order_id') ?? currentOrder?.id ?? ''
  const locationId = searchParams.get('location_id') ?? activeLocationId ?? ''

  const [flowState, setFlowState] = useState<FlowState>('method_select')
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodChoice | null>(null)
  const [paymentResult, setPaymentResult] = useState<PaymentResult>({
    method: '',
    amountCents: 0,
    tipCents: 0,
  })

  const shouldShowTip = useMemo(() => {
    return selectedMethod === 'credit_card' || selectedMethod === 'digital_wallet'
  }, [selectedMethod])

  const handleMethodSelect = useCallback(
    (method: PaymentMethodChoice) => {
      setSelectedMethod(method)
      setPaymentResult((prev) => ({ ...prev, method, amountCents: orderTotalCents }))

      if (method === 'credit_card' || method === 'digital_wallet') {
        setFlowState('processing_card')
      } else if (method === 'cash') {
        setFlowState('processing_cash')
      } else if (method === 'gift_card') {
        setFlowState('processing_gift_card')
      } else if (method === 'house_account') {
        setFlowState('processing_house_account')
      } else if (method === 'split') {
        router.push(`/checks`)
      }
    },
    [orderTotalCents, router]
  )

  const handleCardApproved = useCallback(
    (result: { cardLastFour: string; authCode: string; cardBrand: string; paymentId: string; transactionId: string }) => {
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

  const handleCardDeclined = useCallback((_reason: string) => {
    setFlowState('method_select')
    setSelectedMethod(null)
  }, [])

  const handleCashComplete = useCallback(
    async (tenderedCents: number) => {
      const changeDue = Math.max(0, tenderedCents - orderTotalCents)

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

  const handleGiftCardComplete = useCallback(
    (result: { amountAppliedCents: number; remainingBalanceCents: number }) => {
      setPaymentResult((prev) => ({
        ...prev,
        method: 'gift_card',
        amountCents: result.amountAppliedCents,
      }))
      setFlowState('receipt_prompt')
    },
    []
  )

  const handleHouseAccountComplete = useCallback(
    (result: { accountId: string; accountName: string }) => {
      setPaymentResult((prev) => ({
        ...prev,
        method: 'house_account',
      }))
      toast.success(`Charged to ${result.accountName}`)
      setFlowState('receipt_prompt')
    },
    []
  )

  const handleTipSelected = useCallback(
    async (tipCents: number) => {
      setPaymentResult((prev) => ({ ...prev, tipCents }))

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
          // Continue even if tip adjust fails
        }
      }

      setFlowState('receipt_prompt')
    },
    [paymentResult.paymentId]
  )

  const handleReceiptChoice = useCallback(async (choice: ReceiptChoice) => {
    if (choice === 'email' || choice === 'text') {
      try {
        await fetch(`/api/orders/${orderId}/receipt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: choice }),
        })
      } catch {
        // Silent — receipt delivery is best-effort
      }
    } else if (choice === 'print') {
      try {
        await fetch(`/api/orders/${orderId}/print-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format: 'receipt', include_tip: true }),
        })
      } catch {
        window.print()
      }
    }
    setFlowState('complete')
  }, [orderId])

  const handleDone = useCallback(() => {
    clearCurrentOrder()
    router.push('/orders')
  }, [router, clearCurrentOrder])

  const handleBack = useCallback(() => {
    if (flowState === 'method_select') {
      router.push('/orders')
    } else {
      setFlowState('method_select')
      setSelectedMethod(null)
    }
  }, [flowState, router])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--color-bg)]">
      {flowState !== 'complete' && (
        <div
          className="flex items-center gap-[var(--space-3)] px-[var(--space-4)]"
          style={{ height: 'var(--topbar-height)', borderBottom: '0.5px solid var(--color-border)' }}
        >
          <Button
            variant="ghost"
            size="lg"
            leadingIcon={<ArrowLeft />}
            onClick={handleBack}
          >
            {flowState === 'method_select' ? 'Back to Order' : 'Back'}
          </Button>

          <div className="ml-auto text-right">
            <p className="text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">
              Order Total
            </p>
            <MoneyDisplay
              cents={orderTotalCents}
              className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[var(--color-text)] tabular-nums"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-[var(--space-4)] py-[var(--space-6)]">
        <div className="mx-auto max-w-md">
          {flowState === 'method_select' && (
            <div className="flex flex-col gap-[var(--space-8)] animate-fade-in">
              <div className="text-center">
                <MoneyDisplay
                  cents={orderTotalCents}
                  className="text-[length:var(--type-large-title-size)] font-[var(--weight-semibold)] text-[var(--color-text)] tabular-nums"
                />
                <p className="mt-[var(--space-2)] text-[length:var(--type-callout-size)] text-[var(--color-text-muted)]">
                  Select Payment Method
                </p>
              </div>
              <PaymentMethodGrid onSelect={handleMethodSelect} />
            </div>
          )}

          {flowState === 'processing_card' && (
            <div className="animate-slide-in-right">
              <CardProcessing
                totalCents={orderTotalCents}
                orderId={orderId}
                locationId={locationId}
                onApproved={handleCardApproved}
                onDeclined={handleCardDeclined}
                onCancel={() => {
                  setFlowState('method_select')
                  setSelectedMethod(null)
                }}
              />
            </div>
          )}

          {flowState === 'processing_cash' && (
            <div className="animate-slide-in-right">
              <CashTender totalCents={orderTotalCents} onComplete={handleCashComplete} />
            </div>
          )}

          {flowState === 'processing_gift_card' && (
            <div className="animate-slide-in-right">
              <GiftCardFlow
                totalCents={orderTotalCents}
                orderId={orderId}
                locationId={locationId}
                onComplete={handleGiftCardComplete}
                onCancel={handleBack}
              />
            </div>
          )}

          {flowState === 'processing_house_account' && (
            <div className="animate-slide-in-right">
              <HouseAccountFlow
                totalCents={orderTotalCents}
                orderId={orderId}
                locationId={locationId}
                onComplete={handleHouseAccountComplete}
                onCancel={handleBack}
              />
            </div>
          )}

          {flowState === 'tip_prompt' && (
            <div className="animate-slide-in-right">
              <TipSelector subtotalCents={orderTotalCents} onSelect={handleTipSelected} />
            </div>
          )}

          {flowState === 'receipt_prompt' && (
            <div className="animate-slide-in-right">
              <ReceiptOptions onSelect={handleReceiptChoice} />
            </div>
          )}

          {flowState === 'complete' && (
            <div className="animate-fade-in">
              <PaymentComplete
                totalCents={paymentResult.amountCents}
                tipCents={paymentResult.tipCents}
                paymentMethod={paymentResult.method}
                cardLastFour={paymentResult.cardLastFour}
                changeDueCents={paymentResult.changeDueCents}
                onDone={handleDone}
                autoRedirectMs={3000}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
