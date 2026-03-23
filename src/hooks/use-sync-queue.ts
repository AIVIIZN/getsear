'use client'

import { useState, useEffect, useCallback } from 'react'
import { useOfflineStore } from '@/stores/offline-store'
import { getPendingCount, getPendingCounts, getFailedEntries, onQueueChange } from '@/lib/offline/sync-queue'
import { getUnresolvedConflicts } from '@/lib/offline/conflict-resolver'
import type { SyncQueueEntry, CachedConflict } from '@/lib/offline/db'

interface SyncQueueState {
  pendingCount: number
  pendingByType: Record<string, number>
  failedEntries: SyncQueueEntry[]
  conflicts: CachedConflict[]
  isSyncing: boolean
  syncProgress: number
  lastSyncAt: string | null
}

/**
 * Hook that exposes sync queue state: pending count, progress, conflicts.
 * Listens for changes from other tabs via BroadcastChannel.
 */
export function useSyncQueue(): SyncQueueState {
  const isSyncing = useOfflineStore((s) => s.isSyncing)
  const syncProgress = useOfflineStore((s) => s.syncProgress)
  const lastSyncAt = useOfflineStore((s) => s.lastSyncAt)
  const storeConflicts = useOfflineStore((s) => s.conflicts)

  const [pendingCount, setPendingCount] = useState(0)
  const [pendingByType, setPendingByType] = useState<Record<string, number>>({})
  const [failedEntries, setFailedEntries] = useState<SyncQueueEntry[]>([])
  const [conflicts, setConflicts] = useState<CachedConflict[]>(storeConflicts)

  const refresh = useCallback(async () => {
    try {
      const [count, counts, failed, unresolvedConflicts] = await Promise.all([
        getPendingCount(),
        getPendingCounts(),
        getFailedEntries(),
        getUnresolvedConflicts(),
      ])
      setPendingCount(count)
      setPendingByType(counts)
      setFailedEntries(failed)
      setConflicts(unresolvedConflicts)

      // Update the offline store with counts
      const store = useOfflineStore.getState()
      store.actions.setPendingOps({
        orders: counts['orders'] ?? 0,
        payments: counts['payments'] ?? 0,
        time_entries: counts['time_entrys'] ?? 0,
        tables: counts['tables'] ?? 0,
      })
    } catch {
      // IndexedDB may not be available (SSR)
    }
  }, [])

  useEffect(() => {
    refresh()

    // Listen for changes from other tabs
    const unsubscribe = onQueueChange(refresh)

    // Poll every 5 seconds for updates
    const interval = setInterval(refresh, 5000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [refresh])

  // Refresh when sync state changes
  useEffect(() => {
    refresh()
  }, [isSyncing, refresh])

  return {
    pendingCount,
    pendingByType,
    failedEntries,
    conflicts,
    isSyncing,
    syncProgress,
    lastSyncAt,
  }
}
