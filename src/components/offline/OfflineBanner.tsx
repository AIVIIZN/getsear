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
    bg: 'bg-[var(--color-marketing-accent)]/10 border-b border-[var(--color-marketing-accent)]/20',
    text: 'text-[var(--color-marketing-accent-deep)]',
    icon: WifiOff,
    iconColor: 'text-[var(--color-marketing-accent)]',
    dismissible: true,
  },
  syncing: {
    bg: 'bg-[var(--color-blue-legacy)]/10 border-b border-[var(--color-blue-legacy)]/20',
    text: 'text-[var(--color-blue-deep)]',
    icon: RefreshCw,
    iconColor: 'text-[var(--color-blue-legacy)]',
    dismissible: false,
  },
  synced: {
    bg: 'bg-[var(--color-success-vivid)]/10 border-b border-[var(--color-success-vivid)]/20',
    text: 'text-[var(--color-success-text)]',
    icon: CheckCircle2,
    iconColor: 'text-[var(--color-success-vivid)]',
    dismissible: false,
  },
  conflict: {
    bg: 'bg-[var(--color-danger-strong)]/10 border-b border-[var(--color-danger-strong)]/20',
    text: 'text-[var(--color-danger-800)]',
    icon: AlertTriangle,
    iconColor: 'text-[var(--color-danger-strong)]',
    dismissible: false,
  },
  stale: {
    bg: 'bg-[var(--color-marketing-accent)]/10 border-b border-[var(--color-marketing-accent)]/20',
    text: 'text-[var(--color-marketing-accent-deep)]',
    icon: WifiOff,
    iconColor: 'text-[var(--color-marketing-accent)]',
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
              className="ml-2 shrink-0 rounded-md bg-[var(--color-danger-strong)] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[var(--color-danger-600)] active:bg-[var(--color-danger-700)] transition-colors"
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
