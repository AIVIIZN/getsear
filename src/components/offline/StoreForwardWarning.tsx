'use client'

import { CreditCard, AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOfflineStore } from '@/stores/offline-store'

/**
 * Warning component for store-and-forward card payment status.
 * Shows: count of pending settlements, total amount, settlement window status.
 */
export function StoreForwardWarning() {
  const storeForwardCount = useOfflineStore((s) => s.storeForwardCount)
  const storeForwardTotal = useOfflineStore((s) => s.storeForwardTotal)
  const isOnline = useOfflineStore((s) => s.isOnline)

  if (storeForwardCount === 0) return null

  const formattedTotal = `$${(storeForwardTotal / 100).toFixed(2)}`

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl p-3.5',
        isOnline
          ? 'bg-[var(--color-blue-legacy)]/8 border border-[var(--color-blue-legacy)]/15'
          : 'bg-[var(--color-marketing-accent)]/8 border border-[var(--color-marketing-accent)]/15'
      )}
    >
      <div className={cn(
        'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
        isOnline ? 'bg-[var(--color-blue-legacy)]/10' : 'bg-[var(--color-marketing-accent)]/10'
      )}>
        <CreditCard
          className={cn('h-4 w-4', isOnline ? 'text-[var(--color-blue-legacy)]' : 'text-[var(--color-marketing-accent)]')}
          strokeWidth={2}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[14px] font-semibold text-[var(--color-text)]">
            Store-and-Forward Payments
          </span>
          {!isOnline && (
            <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-marketing-accent)]" strokeWidth={2} />
          )}
        </div>
        <p className="text-[13px] text-[var(--color-text-secondary)] leading-snug">
          {storeForwardCount} card payment{storeForwardCount !== 1 ? 's' : ''} totaling{' '}
          <span className="font-semibold">{formattedTotal}</span>{' '}
          {isOnline ? 'settling now...' : 'pending settlement when online.'}
        </p>
        <div className="flex items-center gap-1 mt-1.5">
          <Clock className="h-3 w-3 text-[var(--color-text-muted)]" strokeWidth={2} />
          <span className="text-[11px] text-[var(--color-text-muted)]">
            Must settle within 24 hours of authorization
          </span>
        </div>
      </div>
    </div>
  )
}
