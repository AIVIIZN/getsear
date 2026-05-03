'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { ManagerPinDialog } from './ManagerPinDialog'
import { cn } from '@/lib/utils'
import { Percent, DollarSign } from 'lucide-react'

interface DiscountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Current order subtotal in cents */
  subtotalCents: number
  /** If provided, discount applies to a specific item */
  itemName?: string
  itemId?: string
  onApply: (params: {
    discount_type: 'percentage' | 'fixed'
    discount_value: number
    reason: string
    managerId?: string
  }) => void
}

const QUICK_PERCENTS = [5, 10, 15, 20, 25, 50, 100]
const QUICK_AMOUNTS = [100, 200, 500, 1000, 1500, 2000] // in cents

const DISCOUNT_REASONS = [
  'Manager comp',
  'Customer complaint',
  'Loyalty reward',
  'Employee discount',
  'Promotion',
  'Service recovery',
  'VIP',
] as const

export function DiscountDialog({
  open,
  onOpenChange,
  subtotalCents,
  itemName,
  itemId,
  onApply,
}: DiscountDialogProps) {
  const [mode, setMode] = useState<'percentage' | 'fixed'>('percentage')
  const [percentValue, setPercentValue] = useState<number | null>(null)
  const [fixedCents, setFixedCents] = useState<number | null>(null)
  const [customInput, setCustomInput] = useState('')
  const [reason, setReason] = useState<string>('')
  const [pinOpen, setPinOpen] = useState(false)

  const discountAmountCents = useMemo(() => {
    if (mode === 'percentage' && percentValue !== null) {
      return Math.round(subtotalCents * (percentValue / 100))
    }
    if (mode === 'fixed' && fixedCents !== null) {
      return Math.min(fixedCents, subtotalCents)
    }
    return 0
  }, [mode, percentValue, fixedCents, subtotalCents])

  const requiresManager = mode === 'percentage' ? (percentValue ?? 0) > 10 : discountAmountCents > Math.round(subtotalCents * 0.1)

  const isValid = discountAmountCents > 0 && reason !== ''

  const handleApplyCustom = useCallback(() => {
    const val = parseFloat(customInput)
    if (isNaN(val) || val <= 0) return
    if (mode === 'percentage') {
      setPercentValue(Math.min(val, 100))
    } else {
      setFixedCents(Math.round(val * 100))
    }
    setCustomInput('')
  }, [customInput, mode])

  const resetAndClose = useCallback(() => {
    setPercentValue(null)
    setFixedCents(null)
    setCustomInput('')
    setReason('')
    setMode('percentage')
    onOpenChange(false)
  }, [onOpenChange])

  const handleConfirm = useCallback(() => {
    if (!isValid) return
    if (requiresManager) {
      setPinOpen(true)
    } else {
      onApply({
        discount_type: mode,
        discount_value: mode === 'percentage' ? (percentValue ?? 0) : (fixedCents ?? 0),
        reason,
      })
      resetAndClose()
    }
  }, [isValid, requiresManager, mode, percentValue, fixedCents, reason, onApply, resetAndClose])

  const handlePinVerified = useCallback(
    (managerId: string) => {
      onApply({
        discount_type: mode,
        discount_value: mode === 'percentage' ? (percentValue ?? 0) : (fixedCents ?? 0),
        reason,
        managerId,
      })
      resetAndClose()
    },
    [mode, percentValue, fixedCents, reason, onApply, resetAndClose]
  )

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else onOpenChange(true) }}>
        <SheetContent side="right" className="w-full max-w-[440px]! flex flex-col" showCloseButton={false}>
          <SheetHeader className="border-b border-border pb-4">
            <SheetTitle className="text-lg">
              {itemName ? `Discount: ${itemName}` : 'Order Discount'}
            </SheetTitle>
            <SheetDescription>
              Subtotal: <MoneyDisplay cents={subtotalCents} className="font-semibold text-foreground" />
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMode('percentage'); setFixedCents(null) }}
                className={cn(
                  'btn-press flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all',
                  mode === 'percentage'
                    ? 'border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]'
                    : 'border-border bg-white text-muted-foreground hover:bg-[var(--secondary)]'
                )}
              >
                <Percent className="h-4 w-4" /> Percentage
              </button>
              <button
                type="button"
                onClick={() => { setMode('fixed'); setPercentValue(null) }}
                className={cn(
                  'btn-press flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all',
                  mode === 'fixed'
                    ? 'border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]'
                    : 'border-border bg-white text-muted-foreground hover:bg-[var(--secondary)]'
                )}
              >
                <DollarSign className="h-4 w-4" /> Fixed Amount
              </button>
            </div>

            {/* Quick values */}
            <div className="grid grid-cols-4 gap-2">
              {mode === 'percentage'
                ? QUICK_PERCENTS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setPercentValue(pct)}
                      className={cn(
                        'btn-press flex h-12 items-center justify-center rounded-xl border text-sm font-semibold transition-all',
                        percentValue === pct
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                          : 'border-border bg-white text-foreground hover:bg-[var(--secondary)]'
                      )}
                    >
                      {pct}%
                    </button>
                  ))
                : QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setFixedCents(amt)}
                      className={cn(
                        'btn-press flex h-12 items-center justify-center rounded-xl border text-sm font-semibold transition-all',
                        fixedCents === amt
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                          : 'border-border bg-white text-foreground hover:bg-[var(--secondary)]'
                      )}
                    >
                      <MoneyDisplay cents={amt} />
                    </button>
                  ))}
            </div>

            {/* Custom input */}
            <div className="flex gap-2">
              <input
                type="number"
                placeholder={mode === 'percentage' ? 'Custom %' : 'Custom $'}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyCustom()}
                className="h-12 flex-1 rounded-xl border border-border bg-[var(--secondary)] px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
                min={0}
                step={mode === 'percentage' ? 1 : 0.01}
              />
              <Button
                onClick={handleApplyCustom}
                disabled={!customInput}
                className="h-12 rounded-xl px-4"
              >
                Set
              </Button>
            </div>

            {/* Discount preview */}
            {discountAmountCents > 0 && (
              <div className="rounded-xl border border-[var(--success)]/30 bg-[var(--success-bg)] p-3 text-center">
                <p className="text-sm text-muted-foreground">Discount amount</p>
                <MoneyDisplay cents={discountAmountCents} className="text-2xl font-bold text-[var(--success)]" />
                {requiresManager && (
                  <p className="mt-1 text-xs font-medium text-[var(--warning)]">
                    Manager approval required ({'>'}10%)
                  </p>
                )}
              </div>
            )}

            {/* Reason */}
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Reason</p>
              <div className="flex flex-wrap gap-1.5">
                {DISCOUNT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={cn(
                      'btn-press rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                      reason === r
                        ? 'border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]'
                        : 'border-border bg-white text-muted-foreground hover:bg-[var(--secondary)]'
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <SheetFooter className="border-t border-border gap-3 pt-4">
            <button
              type="button"
              onClick={resetAndClose}
              className="btn-press touch-target-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <Button
              onClick={handleConfirm}
              disabled={!isValid}
              className="btn-press touch-target-lg flex-1 h-14 rounded-xl text-base font-semibold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-40"
            >
              {requiresManager ? 'Apply — Manager PIN' : 'Apply Discount'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ManagerPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="Manager Approval"
        description={`Discount: ${mode === 'percentage' ? `${percentValue}%` : `$${((fixedCents ?? 0) / 100).toFixed(2)}`}`}
        onVerified={handlePinVerified}
      />
    </>
  )
}
