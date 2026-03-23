/**
 * Open orders cache with real-time sync.
 * Stores current open orders for offline access and offline order creation.
 */

import { offlineDB, type CachedOrder, type CachedOrderItem, type SyncStatus } from './db'
import { createClient } from '@/lib/supabase/client'

/** Counter for offline order numbers, per-session */
let offlineOrderCounter = 0

/**
 * Generate an offline order number: "OFL-001", "OFL-002", etc.
 */
export function generateOfflineOrderNumber(): string {
  offlineOrderCounter++
  return `OFL-${offlineOrderCounter.toString().padStart(3, '0')}`
}

/**
 * Reset offline order counter (call on reconnect after sync).
 */
export function resetOfflineOrderCounter(): void {
  offlineOrderCounter = 0
}

/**
 * Fetch and cache all open orders for a location.
 */
export async function syncOpenOrders(
  locationId: string,
  onProgress?: (loaded: number, label: string) => void
): Promise<{ orderCount: number }> {
  const supabase = createClient()
  const now = new Date().toISOString()

  onProgress?.(0, 'Loading open orders...')
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items(*)
    `)
    .eq('location_id', locationId)
    .in('status', ['draft', 'open', 'fired', 'ready', 'served'])
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch orders: ${error.message}`)

  const cachedOrders: CachedOrder[] = ((orders ?? []) as Record<string, unknown>[]).map((o) => ({
    id: o.id as string,
    order_number: (o.order_number as string) ?? '',
    order_type: (o.order_type as string) ?? 'dine_in',
    status: (o.status as string) ?? 'draft',
    table_id: (o.table_id as string | null) ?? null,
    table_name: (o.table_name as string | null) ?? null,
    server_id: (o.server_id as string) ?? '',
    server_name: (o.server_name as string) ?? '',
    guest_count: (o.guest_count as number) ?? 1,
    items: ((o.order_items as Record<string, unknown>[] | undefined) ?? []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      menu_item_id: (item.menu_item_id as string) ?? '',
      name: (item.name as string) ?? '',
      price_cents: (item.price_cents as number) ?? 0,
      quantity: (item.quantity as number) ?? 1,
      seat_number: (item.seat_number as number | null) ?? null,
      course: (item.course as number) ?? 1,
      status: (item.status as string) ?? 'pending',
      modifiers: (item.modifiers as CachedOrderItem['modifiers']) ?? [],
      special_instructions: (item.special_instructions as string) ?? '',
      voided: (item.voided as boolean) ?? false,
      void_reason: (item.void_reason as string | null) ?? null,
      is_combo: (item.is_combo as boolean) ?? false,
      combo_children: (item.combo_children as CachedOrderItem['combo_children']) ?? [],
      tax_class: (item.tax_class as string) ?? 'food',
      is_taxable: (item.is_taxable as boolean) ?? true,
    })),
    subtotal_cents: (o.subtotal_cents as number) ?? 0,
    discount_cents: (o.discount_cents as number) ?? 0,
    tax_cents: (o.tax_cents as number) ?? 0,
    total_cents: (o.total_cents as number) ?? 0,
    notes: (o.notes as string) ?? '',
    created_at: (o.created_at as string) ?? now,
    for_here: (o.for_here as boolean | null) ?? null,
    location_id: locationId,
    sync_status: 'synced' as SyncStatus,
    offline_number: null,
    synced_at: now,
  }))

  onProgress?.(70, 'Saving orders to cache...')
  await offlineDB.transaction('rw', offlineDB.orders, async () => {
    // Only clear synced orders (keep pending offline orders)
    const syncedIds = await offlineDB.orders
      .where('location_id')
      .equals(locationId)
      .filter((o) => o.sync_status === 'synced')
      .primaryKeys()
    await offlineDB.orders.bulkDelete(syncedIds)

    if (cachedOrders.length > 0) await offlineDB.orders.bulkPut(cachedOrders)
  })

  onProgress?.(100, `Orders cached: ${cachedOrders.length} open orders`)
  return { orderCount: cachedOrders.length }
}

/**
 * Create an offline order in IndexedDB.
 */
export async function createOfflineOrder(order: CachedOrder): Promise<void> {
  await offlineDB.orders.put({
    ...order,
    sync_status: 'pending',
    offline_number: order.offline_number ?? generateOfflineOrderNumber(),
    synced_at: new Date().toISOString(),
  })
}

/**
 * Update an existing order in the cache.
 */
export async function updateOrderInCache(orderId: string, updates: Partial<CachedOrder>): Promise<void> {
  await offlineDB.orders.update(orderId, { ...updates, synced_at: new Date().toISOString() })
}

/**
 * Get all open orders from cache for a location.
 */
export async function getCachedOpenOrders(locationId: string): Promise<CachedOrder[]> {
  return offlineDB.orders
    .where('location_id')
    .equals(locationId)
    .filter((o) => o.status !== 'closed' && o.status !== 'voided')
    .toArray()
}

/**
 * Get a single cached order by ID.
 */
export async function getCachedOrder(orderId: string): Promise<CachedOrder | undefined> {
  return offlineDB.orders.get(orderId)
}

/**
 * Get all pending (unsynced) orders.
 */
export async function getPendingOrders(locationId: string): Promise<CachedOrder[]> {
  return offlineDB.orders
    .where('location_id')
    .equals(locationId)
    .filter((o) => o.sync_status === 'pending')
    .toArray()
}

/**
 * Mark an order as synced after successful server sync.
 */
export async function markOrderSynced(orderId: string, serverOrderNumber?: string): Promise<void> {
  const updates: Partial<CachedOrder> = {
    sync_status: 'synced',
    synced_at: new Date().toISOString(),
  }
  if (serverOrderNumber) {
    updates.order_number = serverOrderNumber
  }
  await offlineDB.orders.update(orderId, updates)
}
