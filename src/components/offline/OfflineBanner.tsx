'use client'

import { useEffect, useState } from 'react'
import { X, WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOfflineStore, type BannerState } from '@/stores/offline-store'
import { useSyncQueue } from '@/hooks/use-sync-queue'

const BANNER_CONFIG: Record<BannerState, {
  bg: string
  text: string
  icon: typeof WifiOff
  iconColor: string
  dismissible: boolean
} | null> = {
  hidden: null,
  offline: {
    bg: 'bg-[#F59E0B]/10 border-b border-[#F59E0B]/20',
    text: 'text-[#92400E]',
    icon: WifiOff,
    iconColor: 'text-[#F59E0B]',
    dismissible: true,
  },
  syncing: {
    bg: 'bg-[#3B82F6]/10 border-b border-[#3B82F6]/20',
    text: 'text-[#1E40AF]',
    icon: RefreshCw,
    iconColor: 'text-[#3B82F6]',
    dismissible: false,
  },
  synced: {
    bg: 'bg-[#22C55E]/10 border-b border-[#22C55E]/20',
    text: 'text-[#166534]',
    icon: CheckCircle2,
    iconColor: 'text-[#22C55E]',
    dismissible: false,
  },
  conflict: {
    bg: 'bg-[#EF4444]/10 border-b border-[#EF4444]/20',
    text: 'text-[#991B1B]',
    icon: AlertTriangle,
    iconColor: 'text-[#EF4444]',
    dismissible: false,
  },
  stale: {
    bg: 'bg-[#F59E0B]/10 border-b border-[#F59E0B]/20',
    text: 'text-[#92400E]',
    icon: WifiOff,
    iconColor: 'text-[#F59E0B]',
    dismissible: false,
  },
}

function getBannerMessage(
  state: BannerState,
  pendingCount: number,
  syncProgress: number,
  conflictCount: number,
  storeForwardCount: number
): string {
  switch (state) {
    case 'offline': {
      let msg = "You're offline. Orders will sync when you reconnect."
      if (storeForwardCount > 0) {
        msg += ` ${storeForwardCount} card payment${storeForwardCount > 1 ? 's' : ''} pending settlement.`
      }
      return msg
    }
    case 'syncing':
      return `Connection restored — syncing ${pendingCount} pending operation${pendingCount !== 1 ? 's' : ''}... ${syncProgress}%`
    case 'synced':
      return `All caught up! ${pendingCount > 0 ? pendingCount : ''} operation${pendingCount !== 1 ? 's' : ''} synced.`
    case 'conflict':
      return `${conflictCount} conflict${conflictCount !== 1 ? 's' : ''} need${conflictCount === 1 ? 's' : ''} attention — a table was assigned to two orders while offline.`
    case 'stale':
      return 'You were offline for an extended period. Syncing and refreshing data...'
    default:
      return ''
  }
}

export function OfflineBanner() {
  const bannerState = useOfflineStore((s) => s.bannerState)
  const bannerDismissed = useOfflineStore((s) => s.bannerDismissed)
  const dismissBanner = useOfflineStore((s) => s.actions.dismissBanner)
  const storeForwardCount = useOfflineStore((s) => s.storeForwardCount)
  const { pendingCount, syncProgress, conflicts } = useSyncQueue()
  const [isVisible, setIsVisible] = useState(false)

  const config = BANNER_CONFIG[bannerState]
  const shouldShow = config !== null && !bannerDismissed

  useEffect(() => {
    if (shouldShow) {
      // Slight delay for spring animation
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
    }
  }, [shouldShow])

  if (!config) return null

  const Icon = config.icon
  const message = getBannerMessage(bannerState, pendingCount, syncProgress, conflicts.length, storeForwardCount)

  return (
    <div
      className={cn(
        'overflow-hidden transition-all duration-300 ease-out',
        isVisible ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2.5',
          config.bg
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon
            className={cn(
              'h-4 w-4 shrink-0',
              config.iconColor,
              bannerState === 'syncing' && 'animate-spin'
            )}
            strokeWidth={2}
          />
          <span className={cn('text-[13px] font-medium leading-tight truncate', config.text)}>
            {message}
          </span>
          {bannerState === 'conflict' && (
            <button
              className="ml-2 shrink-0 rounded-md bg-[#EF4444] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#DC2626] active:bg-[#B91C1C] transition-colors"
              style={{ minHeight: 28 }}
            >
              Resolve
            </button>
          )}
        </div>
        {config.dismissible && (
          <button
            onClick={dismissBanner}
            className="ml-2 shrink-0 rounded-md p-1 hover:bg-black/5 active:bg-black/10 transition-colors"
            aria-label="Dismiss"
            style={{ minWidth: 28, minHeight: 28 }}
          >
            <X className={cn('h-3.5 w-3.5', config.text)} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  )
}
