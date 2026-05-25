'use client'

import { useOfflineStore } from '@/stores/offline-store'

/**
 * Thin progress bar at the very top of the viewport.
 * Ember orange (var(--color-primary)), 3px tall, like YouTube/GitHub loading bar.
 * Only visible during sync.
 */
export function SyncProgressBar() {
  const isSyncing = useOfflineStore((s) => s.isSyncing)
  const syncProgress = useOfflineStore((s) => s.syncProgress)

  if (!isSyncing) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-black/[0.04]"
      role="progressbar"
      aria-valuenow={syncProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Sync progress"
    >
      <div
        className="h-full transition-all duration-300 ease-out"
        style={{
          width: `${syncProgress}%`,
          background: 'linear-gradient(90deg, var(--color-primary), var(--color-marketing-accent))',
          boxShadow: '0 0 8px rgba(240, 107, 24, 0.4)',
        }}
      />
      {/* Animated shimmer overlay */}
      {syncProgress < 100 && (
        <div
          className="absolute top-0 h-full w-24 animate-pulse"
          style={{
            left: `${Math.max(0, syncProgress - 8)}%`,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
          }}
        />
      )}
    </div>
  )
}
