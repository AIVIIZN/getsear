'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useOfflineStore } from '@/stores/offline-store'
import { useSyncQueue } from '@/hooks/use-sync-queue'

/**
 * Topbar connection indicator, replacing the old static green dot.
 * - Green: online, synced
 * - Amber + pulse: offline
 * - Amber + badge: offline with pending operations (iOS-style notification badge)
 * - Blue + spin: syncing
 */
export function SyncStatusIndicator() {
  const connectionState = useOfflineStore((s) => s.connectionState)
  const { pendingCount } = useSyncQueue()
  const [showSyncedFlash, setShowSyncedFlash] = useState(false)

  // Brief "synced" flash animation when transitioning from syncing to online
  useEffect(() => {
    if (connectionState === 'online' && pendingCount === 0) {
      setShowSyncedFlash(true)
      const timeout = setTimeout(() => setShowSyncedFlash(false), 1500)
      return () => clearTimeout(timeout)
    }
  }, [connectionState, pendingCount])

  const isOffline = connectionState === 'offline'
  const isSyncing = connectionState === 'syncing' || connectionState === 'reconnecting'
  const isOnline = connectionState === 'online'

  const dotColor = isOffline
    ? 'bg-[#F59E0B]'
    : isSyncing
      ? 'bg-[#3B82F6]'
      : 'bg-[#34C759]'

  const glowColor = isOffline
    ? 'rgba(245, 158, 11, 0.3)'
    : isSyncing
      ? 'rgba(59, 130, 246, 0.3)'
      : showSyncedFlash
        ? 'rgba(52, 199, 89, 0.4)'
        : 'rgba(52, 199, 89, 0.2)'

  const label = isOffline
    ? `Offline${pendingCount > 0 ? ` — ${pendingCount} pending` : ''}`
    : isSyncing
      ? `Syncing${pendingCount > 0 ? ` ${pendingCount} operations` : ''}...`
      : 'Online'

  return (
    <div className="relative flex items-center gap-1.5" title={label}>
      {/* Dot */}
      <div className="relative">
        <div
          className={cn(
            'h-[8px] w-[8px] rounded-full transition-all duration-300',
            dotColor,
            showSyncedFlash && 'scale-125'
          )}
          style={{ boxShadow: `0 0 0 2px ${glowColor}` }}
        />

        {/* Pulse ring for offline state */}
        {isOffline && (
          <div
            className="absolute inset-0 rounded-full animate-ping bg-[#F59E0B]/40"
            style={{ animationDuration: '2s' }}
          />
        )}

        {/* Pending count badge (iOS-style) */}
        {pendingCount > 0 && !isSyncing && (
          <div
            className={cn(
              'absolute -top-2 -right-2.5 flex items-center justify-center',
              'rounded-full bg-[#F59E0B] text-white',
              'text-[9px] font-bold leading-none',
              'min-w-[14px] h-[14px] px-[3px]',
              'shadow-sm'
            )}
          >
            {pendingCount > 99 ? '99+' : pendingCount}
          </div>
        )}
      </div>

      {/* Label */}
      <span className={cn(
        'text-[13px] transition-colors duration-300',
        isOffline ? 'text-[#F59E0B] font-medium' : 'text-[#8E8E93]'
      )}>
        {isOnline && !isSyncing ? 'Online' : isOffline ? 'Offline' : 'Syncing'}
      </span>
    </div>
  )
}
