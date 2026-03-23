'use client'

import { useState, useCallback, useEffect } from 'react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { ManagerPinDialog } from './ManagerPinDialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Percent, X, Loader2 } from 'lucide-react'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface AutoGratuityBannerProps {
  orderId: string
  guestCount: number
  subtotalCents: number
  /** Threshold from location settings. Default: 6 */
  threshold?: number
  /** Percentage from location settings. Default: 20 */
  percentage?: number
  /** Whether auto-gratuity is currently applied */
  isApplied: boolean
  /** Current auto-gratuity amount in cents (if applied) */
  appliedAmountCents?: number
  /** Called when auto-gratuity is added or removed so parent can refresh */
  onUpdate: () => void
  className?: string
}

// ---------------------------------------------------------------
// AutoGratuityBanner
// ---------------------------------------------------------------

export function AutoGratuityBanner({
  orderId,
  guestCount,
  subtotalCents,
  threshold = 6,
  percentage = 20,
  isApplied,
  appliedAmountCents,
  onUpdate,
  className,
}: AutoGratuityBannerProps) {
  const [isApplying, setIsApplying] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [justAutoApplied, setJustAutoApplied] = useState(false)

  const gratuityAmountCents = appliedAmountCents ?? Math.round(subtotalCents * (percentage / 100))
  const meetsThreshold = guestCount >= threshold

  // Auto-apply when guest count crosses threshold
  useEffect(() => {
    if (meetsThreshold && !isApplied && !justAutoApplied && orderId) {
      applyAutoGratuity()
      setJustAutoApplied(true)
    }
    // Reset auto-apply flag when going below threshold
    if (!meetsThreshold) {
      setJustAutoApplied(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetsThreshold, isApplied, orderId])

  const applyAutoGratuity = useCallback(async () => {
    if (!orderId || isApplying) return
    setIsApplying(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/auto-gratuity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_count: guestCount }),
      })
      if (res.ok) {
        toast.success(`Auto-gratuity (${percentage}%) applied`)
        onUpdate()
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to apply' }))
        // 409 = already applied, not really an error
        if (res.status !== 409) {
          toast.error(err.error ?? 'Failed to apply auto-gratuity')
        }
      }
    } catch {
      toast.error('Network error applying auto-gratuity')
    } finally {
      setIsApplying(false)
    }
  }, [orderId, guestCount, percentage, onUpdate, isApplying])

  const handleRemoveRequest = useCallback(() => {
    setShowPinDialog(true)
  }, [])

  const handlePinVerified = useCallback(
    async (_managerId: string, managerName: string) => {
      setIsRemoving(true)
      try {
        const res = await fetch(`/api/orders/${orderId}/auto-gratuity`, {
          method: 'DELETE',
        })
        if (res.ok) {
          toast.success(`Auto-gratuity removed by ${managerName}`)
          onUpdate()
        } else {
          const err = await res.json().catch(() => ({ error: 'Failed to remove' }))
          toast.error(err.error ?? 'Failed to remove auto-gratuity')
        }
      } catch {
        toast.error('Network error')
      } finally {
        setIsRemoving(false)
      }
    },
    [orderId, onUpdate]
  )

  // Don't render if below threshold and not applied
  if (!meetsThreshold && !isApplied) return null

  // Show banner when applied
  if (isApplied) {
    return (
      <>
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 transition-all',
            'bg-[var(--success-bg)] border border-[var(--success)]/20',
            className
          )}
        >
          <Percent className="h-4 w-4 text-[var(--success)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--success)]">
              Auto-gratuity ({percentage}%) applied
            </p>
          </div>
          <MoneyDisplay
            cents={gratuityAmountCents}
            className="text-sm font-bold text-[var(--success)] shrink-0"
          />
          <button
            type="button"
            onClick={handleRemoveRequest}
            disabled={isRemoving}
            className="btn-press ml-1 flex h-6 w-6 items-center justify-center rounded-md text-[var(--success)] hover:bg-[var(--success)]/10 hover:text-[var(--error)] transition-colors disabled:opacity-40"
            title="Remove auto-gratuity (requires manager PIN)"
          >
            {isRemoving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <ManagerPinDialog
          open={showPinDialog}
          onOpenChange={setShowPinDialog}
          title="Remove Auto-Gratuity"
          description="Manager authorization required to remove auto-gratuity"
          onVerified={handlePinVerified}
        />
      </>
    )
  }

  // Show applying state
  if (isApplying) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2',
          'bg-[var(--warning-bg)] border border-[var(--warning)]/20',
          className
        )}
      >
        <Loader2 className="h-4 w-4 text-[var(--warning)] animate-spin" />
        <p className="text-xs font-semibold text-[var(--warning)]">
          Applying auto-gratuity ({percentage}%)...
        </p>
      </div>
    )
  }

  return null
}
