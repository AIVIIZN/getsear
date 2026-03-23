'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  CreditCard,
  Banknote,
  Gift,
  Building2,
  Check,
  ArrowLeft,
  Delete,
  X,
  Loader2,
} from 'lucide-react'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

type PaymentMethod = 'cash' | 'credit_card' | 'gift_card' | 'house_account'

interface AppliedPayment {
  id: string
  method: PaymentMethod
  amount_cents: number
  tip_cents: number
  label: string
  card_last_four?: string
  card_brand?: string
  auth_code?: string
  change_due_cents?: number
}

interface MultiTenderPaymentProps {
  orderId: string
  locationId: string
  totalCents: number
  subtotalCents: number
  taxCents: number
  autoGratuityCents?: number
  discountCents?: number
  onComplete: () => void
  onCancel: () => void
}

type TenderStep =
  | 'select_method'
  | 'cash_entry'
  | 'card_processing'
  | 'gift_card_entry'
  | 'house_account_select'

const METHODS: Array<{
  id: PaymentMethod
  label: string
  icon: React.ComponentType<{ className?: string }>
  bgColor: string
}> = [
  { id: 'cash', label: 'Cash', icon: Banknote, bgColor: 'bg-[var(--success-bg)] text-[var(--success)]' },
  { id: 'credit_card', label: 'Card', icon: CreditCard, bgColor: 'bg-[var(--info-bg)] text-[var(--info)]' },
  { id: 'gift_card', label: 'Gift Card', icon: Gift, bgColor: 'bg-purple-50 text-purple-700' },
  { id: 'house_account', label: 'House Acct', icon: Building2, bgColor: 'bg-[var(--warning-bg)] text-[var(--warning)]' },
]

// ---------------------------------------------------------------
// Cash Numpad Sub-Component
// ---------------------------------------------------------------

function CashNumpad({
  remainingCents,
  onComplete,
  onCancel,
}: {
  remainingCents: number
  onComplete: (tenderedCents: number) => void
  onCancel: () => void
}) {
  const [inputStr, setInputStr] = useState('')

  const tenderedCents = inputStr ? parseInt(inputStr, 10) : 0
  const changeDueCents = Math.max(0, tenderedCents - remainingCents)
  const isValid = tenderedCents > 0

  const handleKey = useCallback((key: string) => {
    if (key === 'C') {
      setInputStr('')
      return
    }
    if (key === 'DEL') {
      setInputStr((prev) => prev.slice(0, -1))
      return
    }
    setInputStr((prev) => {
      const next = prev + key
      if (parseInt(next, 10) > 9999999) return prev
      return next
    })
  }, [])

  const handleQuickAmount = useCallback(
    (cents: number) => {
      if (cents === 0) {
        onComplete(remainingCents)
      } else {
        setInputStr(String(cents))
      }
    },
    [remainingCents, onComplete]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-xs text-[var(--text-muted)]">Remaining Balance</p>
        <MoneyDisplay cents={remainingCents} className="text-2xl font-bold text-[var(--text-primary)]" />
      </div>

      <div className="rounded-xl bg-[var(--secondary)] p-3 text-center">
        <p className="text-xs text-[var(--text-muted)]">Cash Tendered</p>
        <MoneyDisplay
          cents={tenderedCents}
          className={cn('text-3xl font-bold', tenderedCents > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]')}
        />
      </div>

      {tenderedCents > remainingCents && (
        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)]">Change Due</p>
          <MoneyDisplay cents={changeDueCents} className="text-xl font-bold text-[var(--success)]" />
        </div>
      )}

      {/* Quick amounts */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Exact', cents: 0 },
          { label: '$20', cents: 2000 },
          { label: '$50', cents: 5000 },
          { label: '$100', cents: 10000 },
        ].map((qa) => (
          <button
            key={qa.label}
            type="button"
            onClick={() => handleQuickAmount(qa.cents)}
            className="btn-press rounded-lg bg-[var(--accent)] py-2.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--secondary)]"
            style={{ minHeight: 44 }}
          >
            {qa.label}
          </button>
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', 'DEL'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleKey(key)}
            className={cn(
              'btn-press rounded-lg py-3.5 text-lg font-semibold transition-colors',
              key === 'DEL'
                ? 'bg-[var(--error-bg)] text-[var(--error)] hover:bg-[var(--error)]/20'
                : 'bg-[var(--secondary)] text-[var(--text-primary)] hover:bg-[var(--background-muted)]'
            )}
            style={{ minHeight: 48 }}
          >
            {key === 'DEL' ? <Delete className="h-5 w-5 mx-auto" /> : key}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-press flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--secondary)]"
          style={{ minHeight: 48 }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => onComplete(tenderedCents)}
          disabled={!isValid}
          className="btn-press flex-1 rounded-xl bg-[var(--success)] py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--success-hover)] disabled:opacity-40"
          style={{ minHeight: 48 }}
        >
          Apply Cash
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Card Processing Sub-Component
// ---------------------------------------------------------------

function CardProcessingStep({
  amountCents,
  onApproved,
  onDeclined,
  onCancel,
}: {
  amountCents: number
  onApproved: (result: { cardLastFour: string; authCode: string; cardBrand: string }) => void
  onDeclined: () => void
  onCancel: () => void
}) {
  const [status, setStatus] = useState<'pending' | 'processing' | 'approved' | 'declined'>('pending')
  const [customAmount, setCustomAmount] = useState('')

  const effectiveAmount = customAmount ? Math.round(parseFloat(customAmount) * 100) : amountCents
  const isPartial = customAmount !== '' && effectiveAmount < amountCents && effectiveAmount > 0

  const handleProcess = useCallback(async () => {
    setStatus('processing')
    try {
      // Mock card processing -- real Valor integration in Phase 2
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const lastFour = String(Math.floor(1000 + Math.random() * 9000))
      const authCode = String(Math.floor(100000 + Math.random() * 900000))
      const brands = ['Visa', 'Mastercard', 'Amex', 'Discover']
      const brand = brands[Math.floor(Math.random() * brands.length)]
      setStatus('approved')
      setTimeout(() => {
        onApproved({ cardLastFour: lastFour, authCode, cardBrand: brand })
      }, 500)
    } catch {
      setStatus('declined')
      toast.error('Card declined')
      onDeclined()
    }
  }, [onApproved, onDeclined])

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-xs text-[var(--text-muted)]">Charge to Card</p>
        <MoneyDisplay cents={effectiveAmount} className="text-3xl font-bold text-[var(--text-primary)]" />
      </div>

      {/* Partial amount option */}
      <div className="rounded-xl border border-border p-3">
        <label className="text-xs text-[var(--text-muted)] block mb-1">
          Custom amount (leave empty for full remaining balance)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max={(amountCents / 100).toFixed(2)}
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder={(amountCents / 100).toFixed(2)}
            disabled={status === 'processing'}
            className="h-11 w-full rounded-lg border border-border bg-[var(--secondary)] pl-7 pr-3 text-sm font-semibold text-[var(--text-primary)] tabular-nums focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] disabled:opacity-50"
          />
        </div>
        {isPartial && (
          <p className="text-xs text-[var(--info)] mt-1 font-medium">
            Partial payment -- remaining balance will need another payment method
          </p>
        )}
      </div>

      {status === 'processing' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-12 w-12 text-[var(--primary)] animate-spin" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Present Card on Terminal</p>
          <p className="text-xs text-[var(--text-muted)]">Waiting for card reader...</p>
        </div>
      )}

      {status === 'approved' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-bg)]">
            <Check className="h-7 w-7 text-[var(--success)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--success)]">Approved</p>
        </div>
      )}

      {status === 'pending' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-press flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--secondary)]"
            style={{ minHeight: 48 }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleProcess}
            className="btn-press flex-1 rounded-xl bg-[var(--info)] py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--info-hover)]"
            style={{ minHeight: 48 }}
          >
            Process Card
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------
// Gift Card Entry Sub-Component
// ---------------------------------------------------------------

function GiftCardEntry({
  remainingCents,
  orderId,
  locationId,
  onComplete,
  onCancel,
}: {
  remainingCents: number
  orderId: string
  locationId: string
  onComplete: (amountCents: number) => void
  onCancel: () => void
}) {
  const [cardNumber, setCardNumber] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [isLooking, setIsLooking] = useState(false)
  const [applyAmount, setApplyAmount] = useState('')

  const handleLookup = useCallback(async () => {
    if (!cardNumber.trim()) return
    setIsLooking(true)
    try {
      const res = await fetch(`/api/gift-cards/balance?card_number=${encodeURIComponent(cardNumber)}&location_id=${locationId}`)
      if (res.ok) {
        const json = await res.json()
        setBalance(json.data?.balance_cents ?? 0)
      } else {
        toast.error('Gift card not found')
      }
    } catch {
      // Mock balance for dev
      setBalance(5000) // $50.00
    } finally {
      setIsLooking(false)
    }
  }, [cardNumber, locationId])

  const effectiveAmount = applyAmount
    ? Math.min(Math.round(parseFloat(applyAmount) * 100), balance ?? 0, remainingCents)
    : Math.min(balance ?? 0, remainingCents)

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-xs text-[var(--text-muted)]">Remaining Balance</p>
        <MoneyDisplay cents={remainingCents} className="text-2xl font-bold text-[var(--text-primary)]" />
      </div>

      {/* Card number entry */}
      <div>
        <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
          Gift Card Number
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            placeholder="Enter or scan card number"
            className="h-11 flex-1 rounded-lg border border-border bg-[var(--secondary)] px-3 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
          />
          <button
            type="button"
            onClick={handleLookup}
            disabled={!cardNumber.trim() || isLooking}
            className="btn-press rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40"
            style={{ minHeight: 44 }}
          >
            {isLooking ? 'Looking...' : 'Lookup'}
          </button>
        </div>
      </div>

      {balance !== null && (
        <>
          <div className="rounded-xl bg-purple-50 p-3 text-center">
            <p className="text-xs text-purple-600">Card Balance</p>
            <MoneyDisplay cents={balance} className="text-xl font-bold text-purple-700" />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-secondary)] block mb-1">
              Amount to Apply (leave empty for full balance)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max={(Math.min(balance, remainingCents) / 100).toFixed(2)}
                value={applyAmount}
                onChange={(e) => setApplyAmount(e.target.value)}
                placeholder={(Math.min(balance, remainingCents) / 100).toFixed(2)}
                className="h-11 w-full rounded-lg border border-border bg-[var(--secondary)] pl-7 pr-3 text-sm font-semibold text-[var(--text-primary)] tabular-nums focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="btn-press flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--secondary)]"
              style={{ minHeight: 48 }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => onComplete(effectiveAmount)}
              disabled={effectiveAmount <= 0}
              className="btn-press flex-1 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-700 disabled:opacity-40"
              style={{ minHeight: 48 }}
            >
              Apply <MoneyDisplay cents={effectiveAmount} className="text-sm font-bold" />
            </button>
          </div>
        </>
      )}

      {balance === null && (
        <button
          type="button"
          onClick={onCancel}
          className="btn-press rounded-xl border border-border py-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--secondary)]"
          style={{ minHeight: 48 }}
        >
          Back
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------
// House Account Sub-Component
// ---------------------------------------------------------------

function HouseAccountSelect({
  remainingCents,
  orderId,
  locationId,
  onComplete,
  onCancel,
}: {
  remainingCents: number
  orderId: string
  locationId: string
  onComplete: (amountCents: number, accountName: string) => void
  onCancel: () => void
}) {
  const [search, setSearch] = useState('')
  const [accounts, setAccounts] = useState<Array<{
    id: string
    name: string
    credit_limit_cents: number
    current_balance_cents: number
  }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (!search.trim()) return
    setIsSearching(true)
    try {
      const res = await fetch(`/api/house-accounts?search=${encodeURIComponent(search)}&location_id=${locationId}`)
      if (res.ok) {
        const json = await res.json()
        setAccounts(json.data ?? [])
      }
    } catch {
      // Mock data for dev
      setAccounts([
        { id: '1', name: 'Acme Corp', credit_limit_cents: 100000, current_balance_cents: 25000 },
        { id: '2', name: 'Smith Industries', credit_limit_cents: 50000, current_balance_cents: 5000 },
      ])
    } finally {
      setIsSearching(false)
    }
  }, [search, locationId])

  const selected = accounts.find((a) => a.id === selectedAccount)
  const availableCredit = selected
    ? selected.credit_limit_cents - selected.current_balance_cents
    : 0
  const chargeAmount = Math.min(remainingCents, availableCredit)

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-xs text-[var(--text-muted)]">Charge to House Account</p>
        <MoneyDisplay cents={remainingCents} className="text-2xl font-bold text-[var(--text-primary)]" />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search accounts..."
          className="h-11 flex-1 rounded-lg border border-border bg-[var(--secondary)] px-3 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={!search.trim() || isSearching}
          className="btn-press rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40"
          style={{ minHeight: 44 }}
        >
          {isSearching ? '...' : 'Search'}
        </button>
      </div>

      {accounts.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => setSelectedAccount(account.id)}
              className={cn(
                'btn-press w-full rounded-lg border p-3 text-left transition-all',
                selectedAccount === account.id
                  ? 'border-[var(--primary)] bg-[var(--primary-subtle)]'
                  : 'border-border bg-white hover:bg-[var(--secondary)]'
              )}
            >
              <p className="text-sm font-semibold text-[var(--text-primary)]">{account.name}</p>
              <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
                <span>Balance: <MoneyDisplay cents={account.current_balance_cents} className="text-xs" /></span>
                <span>Limit: <MoneyDisplay cents={account.credit_limit_cents} className="text-xs" /></span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-press flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--secondary)]"
          style={{ minHeight: 48 }}
        >
          Back
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => onComplete(chargeAmount, selected.name)}
            disabled={chargeAmount <= 0}
            className="btn-press flex-1 rounded-xl bg-[var(--warning)] py-3 text-sm font-bold text-[var(--warning-foreground)] transition-colors hover:bg-[var(--warning-hover)] disabled:opacity-40"
            style={{ minHeight: 48 }}
          >
            Charge <MoneyDisplay cents={chargeAmount} className="text-sm font-bold" />
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Main MultiTenderPayment Component
// ---------------------------------------------------------------

export function MultiTenderPayment({
  orderId,
  locationId,
  totalCents,
  subtotalCents,
  taxCents,
  autoGratuityCents = 0,
  discountCents = 0,
  onComplete,
  onCancel,
}: MultiTenderPaymentProps) {
  const [appliedPayments, setAppliedPayments] = useState<AppliedPayment[]>([])
  const [tenderStep, setTenderStep] = useState<TenderStep>('select_method')

  const totalPaidCents = useMemo(
    () => appliedPayments.reduce((sum, p) => sum + p.amount_cents, 0),
    [appliedPayments]
  )

  const remainingCents = Math.max(0, totalCents - totalPaidCents)
  const isFullyPaid = remainingCents <= 0

  // Record a payment to the API
  const recordPayment = useCallback(
    async (method: PaymentMethod, amountCents: number, tipCents: number, meta: Record<string, string> = {}) => {
      try {
        await fetch('/api/payments/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
            location_id: locationId,
            payment_method: method,
            amount_cents: amountCents,
            tip_cents: tipCents,
            ...meta,
          }),
        })
      } catch {
        // Continue even if API fails in dev
      }
    },
    [orderId, locationId]
  )

  // Close check when fully paid
  const handleCloseCheck = useCallback(async () => {
    try {
      await fetch(`/api/orders/${orderId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {
      // Continue
    }
    onComplete()
  }, [orderId, onComplete])

  // Cash payment complete
  const handleCashComplete = useCallback(
    async (tenderedCents: number) => {
      const paymentAmount = Math.min(tenderedCents, remainingCents)
      const changeDue = Math.max(0, tenderedCents - remainingCents)

      await recordPayment('cash', paymentAmount, 0, {
        cash_tendered_cents: String(tenderedCents),
      })

      const payment: AppliedPayment = {
        id: crypto.randomUUID(),
        method: 'cash',
        amount_cents: paymentAmount,
        tip_cents: 0,
        label: 'Cash',
        change_due_cents: changeDue,
      }

      setAppliedPayments((prev) => [...prev, payment])
      setTenderStep('select_method')

      if (changeDue > 0) {
        toast.success(`Change due: $${(changeDue / 100).toFixed(2)}`)
      }
    },
    [remainingCents, recordPayment]
  )

  // Card payment complete
  const handleCardApproved = useCallback(
    async (result: { cardLastFour: string; authCode: string; cardBrand: string }) => {
      // The effective amount is whatever remaining balance was or partial amount
      const amountCents = remainingCents // Will be adjusted if partial

      await recordPayment('credit_card', amountCents, 0, {
        card_last_four: result.cardLastFour,
        auth_code: result.authCode,
        card_brand: result.cardBrand,
      })

      const payment: AppliedPayment = {
        id: crypto.randomUUID(),
        method: 'credit_card',
        amount_cents: amountCents,
        tip_cents: 0,
        label: `${result.cardBrand} ...${result.cardLastFour}`,
        card_last_four: result.cardLastFour,
        card_brand: result.cardBrand,
        auth_code: result.authCode,
      }

      setAppliedPayments((prev) => [...prev, payment])
      setTenderStep('select_method')
    },
    [remainingCents, recordPayment]
  )

  // Gift card complete
  const handleGiftCardComplete = useCallback(
    async (amountCents: number) => {
      await recordPayment('gift_card', amountCents, 0)

      const payment: AppliedPayment = {
        id: crypto.randomUUID(),
        method: 'gift_card',
        amount_cents: amountCents,
        tip_cents: 0,
        label: 'Gift Card',
      }

      setAppliedPayments((prev) => [...prev, payment])
      setTenderStep('select_method')
    },
    [recordPayment]
  )

  // House account complete
  const handleHouseAccountComplete = useCallback(
    async (amountCents: number, accountName: string) => {
      await recordPayment('house_account', amountCents, 0)

      const payment: AppliedPayment = {
        id: crypto.randomUUID(),
        method: 'house_account',
        amount_cents: amountCents,
        tip_cents: 0,
        label: `House: ${accountName}`,
      }

      setAppliedPayments((prev) => [...prev, payment])
      setTenderStep('select_method')
      toast.success(`Charged to ${accountName}`)
    },
    [recordPayment]
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--background)]">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{ height: 56, borderBottom: '0.5px solid var(--border)' }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="btn-press flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--secondary)] transition-colors"
          style={{ minHeight: 44 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="ml-auto text-right">
          <p className="text-xs text-[var(--text-muted)]">Order Total</p>
          <MoneyDisplay cents={totalCents} className="text-lg font-bold text-[var(--text-primary)] tabular-nums" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-md space-y-4">
          {/* Payment summary card */}
          <div className="rounded-xl border border-border bg-white p-4 shadow-warm-sm">
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Subtotal</span>
                <MoneyDisplay cents={subtotalCents} className="text-sm font-medium" />
              </div>
              {discountCents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--success)]">Discount</span>
                  <MoneyDisplay cents={-discountCents} className="text-sm font-medium text-[var(--success)]" />
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Tax</span>
                <MoneyDisplay cents={taxCents} className="text-sm font-medium" />
              </div>
              {autoGratuityCents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Service Charge</span>
                  <MoneyDisplay cents={autoGratuityCents} className="text-sm font-medium" />
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: '0.5px solid var(--border)' }}>
                <span className="text-[var(--text-primary)]">Total</span>
                <MoneyDisplay cents={totalCents} className="text-base font-bold" />
              </div>
            </div>
          </div>

          {/* Applied payments */}
          {appliedPayments.length > 0 && (
            <div className="rounded-xl border border-border bg-white p-4 shadow-warm-sm">
              <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Payments Applied
              </h4>
              <div className="space-y-2">
                {appliedPayments.map((payment, idx) => {
                  const MethodIcon = METHODS.find((m) => m.id === payment.method)?.icon ?? CreditCard
                  return (
                    <div key={payment.id} className="flex items-center gap-3 rounded-lg bg-[var(--success-bg)] px-3 py-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--success)]/10">
                        <Check className="h-4 w-4 text-[var(--success)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          Payment {idx + 1}: {payment.label}
                        </p>
                        {payment.change_due_cents && payment.change_due_cents > 0 && (
                          <p className="text-xs text-[var(--success)]">
                            Change: <MoneyDisplay cents={payment.change_due_cents} className="text-xs" />
                          </p>
                        )}
                      </div>
                      <MoneyDisplay cents={payment.amount_cents} className="text-sm font-bold text-[var(--success)]" />
                    </div>
                  )
                })}
              </div>

              {/* Remaining balance */}
              {!isFullyPaid && (
                <div className="flex justify-between mt-3 pt-2" style={{ borderTop: '0.5px solid var(--border)' }}>
                  <span className="text-sm font-bold text-[var(--error)]">Remaining Balance</span>
                  <MoneyDisplay cents={remainingCents} className="text-lg font-bold text-[var(--error)]" />
                </div>
              )}
            </div>
          )}

          {/* Fully paid -- close check */}
          {isFullyPaid && (
            <div className="text-center py-4">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-[var(--success-bg)] mb-3">
                <Check className="h-8 w-8 text-[var(--success)]" />
              </div>
              <p className="text-lg font-bold text-[var(--success)]">Fully Paid</p>
              <button
                type="button"
                onClick={handleCloseCheck}
                className="btn-press mt-4 w-full rounded-xl bg-[var(--success)] py-4 text-base font-bold text-white transition-all hover:bg-[var(--success-hover)]"
                style={{ minHeight: 56 }}
              >
                Close Check
              </button>
            </div>
          )}

          {/* Payment method select or tender flow */}
          {!isFullyPaid && tenderStep === 'select_method' && (
            <div>
              <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3">
                {appliedPayments.length === 0 ? 'Select Payment Method' : 'Add Another Payment'}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {METHODS.map((method) => {
                  const Icon = method.icon
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => {
                        if (method.id === 'cash') setTenderStep('cash_entry')
                        else if (method.id === 'credit_card') setTenderStep('card_processing')
                        else if (method.id === 'gift_card') setTenderStep('gift_card_entry')
                        else if (method.id === 'house_account') setTenderStep('house_account_select')
                      }}
                      className={cn(
                        'btn-press flex flex-col items-center justify-center gap-2 rounded-xl p-5 transition-all hover:shadow-warm-md hover:scale-[1.02] active:scale-[0.97]',
                        method.bgColor
                      )}
                      style={{ minHeight: 100 }}
                    >
                      <Icon className="h-7 w-7" />
                      <span className="text-sm font-semibold">{method.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {!isFullyPaid && tenderStep === 'cash_entry' && (
            <CashNumpad
              remainingCents={remainingCents}
              onComplete={handleCashComplete}
              onCancel={() => setTenderStep('select_method')}
            />
          )}

          {!isFullyPaid && tenderStep === 'card_processing' && (
            <CardProcessingStep
              amountCents={remainingCents}
              onApproved={handleCardApproved}
              onDeclined={() => setTenderStep('select_method')}
              onCancel={() => setTenderStep('select_method')}
            />
          )}

          {!isFullyPaid && tenderStep === 'gift_card_entry' && (
            <GiftCardEntry
              remainingCents={remainingCents}
              orderId={orderId}
              locationId={locationId}
              onComplete={handleGiftCardComplete}
              onCancel={() => setTenderStep('select_method')}
            />
          )}

          {!isFullyPaid && tenderStep === 'house_account_select' && (
            <HouseAccountSelect
              remainingCents={remainingCents}
              orderId={orderId}
              locationId={locationId}
              onComplete={handleHouseAccountComplete}
              onCancel={() => setTenderStep('select_method')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
