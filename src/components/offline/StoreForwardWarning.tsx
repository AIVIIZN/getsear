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
          ? 'bg-[#3B82F6]/8 border border-[#3B82F6]/15'
          : 'bg-[#F59E0B]/8 border border-[#F59E0B]/15'
      )}
    >
      <div className={cn(
        'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
        isOnline ? 'bg-[#3B82F6]/10' : 'bg-[#F59E0B]/10'
      )}>
        <CreditCard
          className={cn('h-4 w-4', isOnline ? 'text-[#3B82F6]' : 'text-[#F59E0B]')}
          strokeWidth={2}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[14px] font-semibold text-[#1C1C1E]">
            Store-and-Forward Payments
          </span>
          {!isOnline && (
            <AlertTriangle className="h-3.5 w-3.5 text-[#F59E0B]" strokeWidth={2} />
          )}
        </div>
        <p className="text-[13px] text-[#3C3C43] leading-snug">
          {storeForwardCount} card payment{storeForwardCount !== 1 ? 's' : ''} totaling{' '}
          <span className="font-semibold">{formattedTotal}</span>{' '}
          {isOnline ? 'settling now...' : 'pending settlement when online.'}
        </p>
        <div className="flex items-center gap-1 mt-1.5">
          <Clock className="h-3 w-3 text-[#8E8E93]" strokeWidth={2} />
          <span className="text-[11px] text-[#8E8E93]">
            Must settle within 24 hours of authorization
          </span>
        </div>
      </div>
    </div>
  )
}
