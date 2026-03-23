/**
 * Cache warmer: orchestrates full cache warm on login.
 * Fetches menu, tables, staff, settings, open orders — writes to IndexedDB.
 * Shows progress via the offline store.
 */

import { syncFullMenu } from './menu-cache'
import { syncTables } from './tables-cache'
import { syncStaff } from './staff-cache'
import { syncSettings } from './settings-cache'
import { syncOpenOrders } from './orders-cache'
import { markCacheInitialized, isCacheInitialized, checkAndReportQuota, setLastSyncAt } from './cache-manager'
import { useOfflineStore } from '@/stores/offline-store'

export interface CacheWarmResult {
  categories: number
  menuItems: number
  tables: number
  floorPlans: number
  staff: number
  settings: number
  taxRates: number
  orders: number
  durationMs: number
}

/**
 * Perform a full cache warm for a location.
 * Called after login, before showing the POS screen.
 */
export async function warmCache(locationId: string): Promise<CacheWarmResult> {
  const store = useOfflineStore.getState()
  const start = Date.now()
  const result: CacheWarmResult = {
    categories: 0,
    menuItems: 0,
    tables: 0,
    floorPlans: 0,
    staff: 0,
    settings: 0,
    taxRates: 0,
    orders: 0,
    durationMs: 0,
  }

  try {
    // Stage 1: Menu (40% of progress)
    store.actions.setCacheWarmProgress(5, 'Loading menu...')
    const menuResult = await syncFullMenu(locationId, (pct, label) => {
      store.actions.setCacheWarmProgress(5 + Math.round(pct * 0.35), label)
    })
    result.categories = menuResult.categoryCount
    result.menuItems = menuResult.itemCount

    // Stage 2: Tables (15% of progress)
    store.actions.setCacheWarmProgress(42, 'Loading tables...')
    const tableResult = await syncTables(locationId, (pct, label) => {
      store.actions.setCacheWarmProgress(42 + Math.round(pct * 0.13), label)
    })
    result.tables = tableResult.tableCount
    result.floorPlans = tableResult.floorPlanCount

    // Stage 3: Staff (10% of progress)
    store.actions.setCacheWarmProgress(57, 'Loading staff...')
    const staffResult = await syncStaff(locationId, (pct, label) => {
      store.actions.setCacheWarmProgress(57 + Math.round(pct * 0.08), label)
    })
    result.staff = staffResult.staffCount

    // Stage 4: Settings (10% of progress)
    store.actions.setCacheWarmProgress(67, 'Loading settings...')
    const settingsResult = await syncSettings(locationId, (pct, label) => {
      store.actions.setCacheWarmProgress(67 + Math.round(pct * 0.08), label)
    })
    result.settings = settingsResult.settingsCount
    result.taxRates = settingsResult.taxRateCount

    // Stage 5: Open orders (20% of progress)
    store.actions.setCacheWarmProgress(77, 'Loading open orders...')
    const orderResult = await syncOpenOrders(locationId, (pct, label) => {
      store.actions.setCacheWarmProgress(77 + Math.round(pct * 0.18), label)
    })
    result.orders = orderResult.orderCount

    // Stage 6: Finalize
    store.actions.setCacheWarmProgress(97, 'Finalizing...')
    await markCacheInitialized()
    await setLastSyncAt('full_warm', new Date().toISOString())
    await checkAndReportQuota()

    result.durationMs = Date.now() - start

    store.actions.setCacheWarmProgress(100, 'Ready!')
    store.actions.setCacheWarmed(true)
    store.actions.setLastSyncAt(new Date().toISOString())

    console.log(
      `[CacheWarmer] Warm complete in ${result.durationMs}ms: ` +
      `${result.menuItems} items, ${result.tables} tables, ` +
      `${result.staff} staff, ${result.orders} orders`
    )

    return result
  } catch (error) {
    console.error('[CacheWarmer] Cache warm failed:', error)
    store.actions.setCacheWarmProgress(0, 'Cache warm failed. Retrying...')
    throw error
  }
}

/**
 * Check if cache needs warming (first time or after logout).
 */
export async function needsCacheWarm(): Promise<boolean> {
  return !(await isCacheInitialized())
}

/**
 * Perform an incremental sync (lighter than full warm).
 * Used when returning from background with existing cache.
 */
export async function incrementalSync(locationId: string): Promise<void> {
  const store = useOfflineStore.getState()

  try {
    // Just re-sync orders and tables (most likely to have changed)
    await syncOpenOrders(locationId)
    await syncTables(locationId)
    await setLastSyncAt('incremental_sync', new Date().toISOString())
    store.actions.setLastSyncAt(new Date().toISOString())
  } catch (error) {
    console.error('[CacheWarmer] Incremental sync failed:', error)
  }
}
