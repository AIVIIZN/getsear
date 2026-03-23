/**
 * Cache manager: orchestrates all cache operations.
 * Warm (full sync on login), incremental update, invalidation, quota check.
 */

import { offlineDB, checkStorageQuota } from './db'
import { useOfflineStore } from '@/stores/offline-store'

/** Target maximum cache size: 5MB */
const TARGET_MAX_BYTES = 5 * 1024 * 1024

/**
 * Get the last sync timestamp for a given cache key.
 */
export async function getLastSyncAt(key: string): Promise<string | null> {
  const meta = await offlineDB.cache_meta
    .where('key')
    .equals(key)
    .first()
  return meta?.value ?? null
}

/**
 * Set the last sync timestamp for a given cache key.
 */
export async function setLastSyncAt(key: string, timestamp: string): Promise<void> {
  await offlineDB.cache_meta.put({
    id: key,
    key,
    value: timestamp,
    updated_at: new Date().toISOString(),
  })
}

/**
 * Check if the cache has been initialized (at least one full warm).
 */
export async function isCacheInitialized(): Promise<boolean> {
  const meta = await offlineDB.cache_meta
    .where('key')
    .equals('cache_initialized')
    .first()
  return meta?.value === 'true'
}

/**
 * Mark cache as initialized.
 */
export async function markCacheInitialized(): Promise<void> {
  await offlineDB.cache_meta.put({
    id: 'cache_initialized',
    key: 'cache_initialized',
    value: 'true',
    updated_at: new Date().toISOString(),
  })
}

/**
 * Check and report storage quota.
 */
export async function checkAndReportQuota(): Promise<void> {
  const quota = await checkStorageQuota()
  const store = useOfflineStore.getState()
  store.actions.setQuota(quota.percent, quota.isWarning)

  if (quota.isWarning) {
    console.warn(
      `[CacheManager] Storage quota warning: ${quota.percent}% used ` +
      `(${formatBytes(quota.used)} / ${formatBytes(quota.quota)})`
    )
  }

  // If over target, try to trim old data
  if (quota.used > TARGET_MAX_BYTES) {
    await trimCache()
  }
}

/**
 * Trim cache to stay within target size.
 * Remove: synced orders older than 24h, old sync queue entries.
 */
async function trimCache(): Promise<void> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Remove old synced orders
  const oldSyncedOrders = await offlineDB.orders
    .filter((o) => o.sync_status === 'synced' && o.created_at < dayAgo)
    .primaryKeys()
  if (oldSyncedOrders.length > 0) {
    await offlineDB.orders.bulkDelete(oldSyncedOrders)
  }

  // Remove old synced queue entries
  const oldSynced = await offlineDB.sync_queue
    .where('status')
    .equals('synced')
    .primaryKeys()
  if (oldSynced.length > 0) {
    await offlineDB.sync_queue.bulkDelete(oldSynced)
  }

  // Remove resolved conflicts older than 24h
  const oldConflicts = await offlineDB.conflicts
    .filter((c) => c.resolved && c.created_at < dayAgo)
    .primaryKeys()
  if (oldConflicts.length > 0) {
    await offlineDB.conflicts.bulkDelete(oldConflicts)
  }
}

/**
 * Invalidate all cache for a location (force full re-sync).
 */
export async function invalidateCache(locationId: string): Promise<void> {
  await offlineDB.transaction(
    'rw',
    [
      offlineDB.menu_categories,
      offlineDB.menu_items,
      offlineDB.restaurant_tables,
      offlineDB.floor_plans,
      offlineDB.staff,
      offlineDB.settings,
      offlineDB.tax_rates,
      offlineDB.cache_meta,
    ],
    async () => {
      await offlineDB.menu_categories.where('location_id').equals(locationId).delete()
      await offlineDB.menu_items.where('location_id').equals(locationId).delete()
      await offlineDB.restaurant_tables.where('location_id').equals(locationId).delete()
      await offlineDB.floor_plans.where('location_id').equals(locationId).delete()
      await offlineDB.staff.where('location_id').equals(locationId).delete()
      await offlineDB.settings.where('location_id').equals(locationId).delete()
      await offlineDB.tax_rates.where('location_id').equals(locationId).delete()
      // Remove the initialized flag
      await offlineDB.cache_meta.delete('cache_initialized')
    }
  )
}

/**
 * Format bytes to human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}
