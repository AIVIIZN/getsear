/**
 * Reconnection manager: orchestrates the full reconnection sequence.
 * 1. Detect real connectivity (health check)
 * 2. Process sync queue (card payments first)
 * 3. Re-sync open orders and KDS tickets
 * 4. Re-establish Supabase Realtime subscriptions
 * 5. Check for stale data (>4hr offline = full menu re-sync)
 */

import { pingHealth } from './health-check'
import { processSyncQueue } from './sync-processor'
import { syncOpenOrders } from './orders-cache'
import { syncFullMenu, isMenuCacheFresh } from './menu-cache'
import { syncTables } from './tables-cache'
import { getPendingCount } from './sync-queue'
import { getUnresolvedConflicts } from './conflict-resolver'
import { checkSettlementWindow } from './valor-store-forward'
import { useOfflineStore } from '@/stores/offline-store'

/** Debounce period: wait 3 seconds before acting on connectivity change */
const RECONNECT_DEBOUNCE_MS = 3000

/** Threshold for stale data warning */
const STALE_DATA_THRESHOLD_MS = 4 * 60 * 60 * 1000 // 4 hours

/** Health check interval when offline (5 seconds) */
const OFFLINE_PING_INTERVAL_MS = 5000

let pingInterval: ReturnType<typeof setInterval> | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let isReconnecting = false

/**
 * Start monitoring for reconnection.
 * Called when the app goes offline.
 */
export function startOfflineMonitoring(): void {
  if (pingInterval) return

  const store = useOfflineStore.getState()
  store.actions.setOfflineSince(new Date().toISOString())

  pingInterval = setInterval(async () => {
    const online = await pingHealth()
    if (online) {
      debouncedReconnect()
    }
  }, OFFLINE_PING_INTERVAL_MS)
}

/**
 * Stop monitoring (called when reconnection succeeds or app is online).
 */
export function stopOfflineMonitoring(): void {
  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

/**
 * Debounced reconnection trigger.
 * Waits 3 seconds to avoid thrashing on flaky connections.
 */
function debouncedReconnect(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    handleReconnection()
  }, RECONNECT_DEBOUNCE_MS)
}

/**
 * Handle the full reconnection sequence.
 */
export async function handleReconnection(): Promise<void> {
  if (isReconnecting) return
  isReconnecting = true

  const store = useOfflineStore.getState()

  try {
    // Step 1: Verify connectivity
    const online = await pingHealth()
    if (!online) {
      isReconnecting = false
      return
    }

    stopOfflineMonitoring()
    store.actions.setConnectionState('reconnecting')

    // Step 2: Check how long we were offline
    const offlineSince = store.offlineSince
    const offlineDurationMs = offlineSince
      ? Date.now() - new Date(offlineSince).getTime()
      : 0

    const isStale = offlineDurationMs > STALE_DATA_THRESHOLD_MS
    if (isStale) {
      store.actions.setBannerState('stale')
    }

    // Step 3: Check for expiring store-forward payments
    const expiredPayments = await checkSettlementWindow()
    if (expiredPayments.length > 0) {
      console.warn(`[Reconnection] ${expiredPayments.length} store-forward payments nearing 24hr window`)
    }

    // Step 4: Process sync queue
    const pendingCount = await getPendingCount()
    if (pendingCount > 0) {
      store.actions.setSyncing(true)
      store.actions.setBannerState('syncing')

      const result = await processSyncQueue()
      console.log(`[Reconnection] Sync complete: ${result.processed} processed, ${result.failed} failed, ${result.conflicts} conflicts`)
    }

    // Step 5: If stale, do full menu re-sync
    const locationId = getActiveLocationId()
    if (locationId) {
      const menuFresh = await isMenuCacheFresh(locationId)
      if (!menuFresh || isStale) {
        store.actions.setCacheWarmProgress(0, 'Re-syncing menu data...')
        await syncFullMenu(locationId)
      }

      // Step 6: Re-sync open orders and tables (always, to catch changes from other terminals)
      store.actions.setCacheWarmProgress(70, 'Re-syncing open orders...')
      await syncOpenOrders(locationId)
      await syncTables(locationId)
    }

    // Step 7: Check for conflicts
    const conflicts = await getUnresolvedConflicts(locationId ?? undefined)
    if (conflicts.length > 0) {
      store.actions.setConflicts(conflicts)
      store.actions.setBannerState('conflict')
    } else {
      store.actions.setBannerState('synced')
      // Auto-hide after 3s
      setTimeout(() => {
        const current = useOfflineStore.getState()
        if (current.bannerState === 'synced') {
          current.actions.setBannerState('hidden')
        }
      }, 3000)
    }

    // Step 8: Mark as online
    store.actions.setConnectionState('online')
    store.actions.setOnline(true)
    store.actions.setLastSyncAt(new Date().toISOString())
    store.actions.setOfflineSince(null)
    store.actions.setSyncing(false)

  } catch (error) {
    console.error('[Reconnection] Error during reconnection:', error)
    // If reconnection fails, go back to offline monitoring
    store.actions.setConnectionState('offline')
    startOfflineMonitoring()
  } finally {
    isReconnecting = false
  }
}

/**
 * Handle the transition to offline state.
 */
export function handleGoingOffline(): void {
  const store = useOfflineStore.getState()
  store.actions.setConnectionState('offline')
  store.actions.setOnline(false)
  store.actions.setBannerState('offline')
  startOfflineMonitoring()
}

/**
 * Get the active location ID from the auth store.
 * Uses dynamic import to avoid circular dependencies.
 */
function getActiveLocationId(): string | null {
  try {
    // Access Zustand store directly (it's already loaded)
    const authState = JSON.parse(localStorage.getItem('sear-auth') ?? '{}')
    return authState?.state?.activeLocationId ?? null
  } catch {
    return null
  }
}

/**
 * Check if we're currently reconnecting.
 */
export function isCurrentlyReconnecting(): boolean {
  return isReconnecting
}
