/**
 * Dexie IndexedDB database definition for Sear POS offline mode.
 * All offline data is stored here: menu, tables, staff, settings, orders, KDS tickets, sync queue.
 * Target: <5MB total. Warn at 80% of browser quota.
 */

import Dexie, { type EntityTable } from 'dexie'

// ─── Cached entity types ───────────────────────────────────────────

export interface CachedMenuCategory {
  id: string
  name: string
  color: string
  sort_order: number
  is_active: boolean
  item_count: number
  location_id: string
  synced_at: string
}

export interface CachedMenuItem {
  id: string
  name: string
  description: string
  price_cents: number
  category_id: string
  is_available: boolean
  is_taxable: boolean
  sort_order: number
  image_url: string | null
  allergens: string[]
  modifier_groups: CachedModifierGroup[]
  price_type: string
  min_price_cents: number | null
  max_price_cents: number | null
  combo_group_id: string | null
  combo_name: string | null
  combo_price_cents: number | null
  combo_slots: CachedComboSlot[]
  tax_class: string
  location_id: string
  synced_at: string
}

export interface CachedModifierGroup {
  id: string
  name: string
  is_required: boolean
  min_selections: number
  max_selections: number
  modifiers: CachedModifier[]
}

export interface CachedModifier {
  id: string
  name: string
  price_cents: number
  is_available: boolean
  sort_order: number
}

export interface CachedComboSlot {
  id: string
  name: string
  sort_order: number
  options: CachedComboSlotOption[]
}

export interface CachedComboSlotOption {
  id: string
  menu_item_id: string
  name: string
  upcharge_cents: number
  is_default: boolean
  modifier_groups: CachedModifierGroup[]
}

export interface CachedTable {
  id: string
  name: string
  section: string
  status: string
  capacity: number
  position_x: number
  position_y: number
  shape: { type: string; width: number; height: number }
  current_order_id: string | null
  current_server_id: string | null
  current_server_name: string | null
  guest_count: number
  seated_at: string | null
  floor_plan_id: string
  location_id: string
  synced_at: string
}

export interface CachedFloorPlan {
  id: string
  name: string
  is_default: boolean
  location_id: string
  synced_at: string
}

export interface CachedStaff {
  id: string
  display_name: string
  email: string
  role: string
  pin_hash: string | null
  is_active: boolean
  location_id: string
  avatar_color: string | null
  synced_at: string
}

export interface CachedSettings {
  id: string
  key: string
  value: string
  location_id: string
  synced_at: string
}

export interface CachedTaxRate {
  id: string
  name: string
  rate: number
  tax_class: string
  applies_to_dine_in: boolean
  applies_to_takeout: boolean
  is_active: boolean
  location_id: string
  synced_at: string
}

export interface CachedOrder {
  id: string
  order_number: string
  order_type: string
  status: string
  table_id: string | null
  table_name: string | null
  server_id: string
  server_name: string
  guest_count: number
  items: CachedOrderItem[]
  subtotal_cents: number
  discount_cents: number
  tax_cents: number
  total_cents: number
  notes: string
  created_at: string
  for_here: boolean | null
  location_id: string
  sync_status: SyncStatus
  offline_number: string | null
  synced_at: string
}

export interface CachedOrderItem {
  id: string
  menu_item_id: string
  name: string
  price_cents: number
  quantity: number
  seat_number: number | null
  course: number
  status: string
  modifiers: { id: string; modifier_id: string; name: string; price_cents: number; quantity: number }[]
  special_instructions: string
  voided: boolean
  void_reason: string | null
  is_combo: boolean
  combo_children: { id: string; menu_item_id: string; name: string; slot_name: string; upcharge_cents: number; modifiers: { id: string; modifier_id: string; name: string; price_cents: number; quantity: number }[] }[]
  tax_class: string
  is_taxable: boolean
}

export interface CachedKdsTicket {
  id: string
  order_id: string
  order_number: string
  order_type: string
  server_name: string
  table_name: string | null
  items: Record<string, unknown>[]
  created_at: string
  station_id: string
  location_id: string
  sync_status: SyncStatus
  synced_at: string
}

// ─── Sync queue types ──────────────────────────────────────────────

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict' | 'store_and_forward'

export type SyncOperation =
  | 'create_order'
  | 'update_order'
  | 'add_order_items'
  | 'void_order'
  | 'close_order'
  | 'create_payment'
  | 'settle_payment'
  | 'clock_in'
  | 'clock_out'
  | 'update_table'

export type SyncEntityType = 'order' | 'payment' | 'time_entry' | 'table' | 'kds_ticket'

export interface SyncQueueEntry {
  id: string
  operation: SyncOperation
  entity_type: SyncEntityType
  entity_id: string
  payload: Record<string, unknown>
  status: SyncStatus
  priority: number // 0 = highest (card payments), 10 = normal, 20 = low
  attempts: number
  max_attempts: number
  created_at: string
  last_attempt_at: string | null
  error: string | null
  location_id: string
  /**
   * V5.3.1 — UUIDv4 minted at enqueue time. Sent as the `Idempotency-Key`
   * header on every retry so the server can dedupe replays after a network
   * blip dropped the original ack but the write actually landed. Optional in
   * the type because legacy entries persisted before this version may lack it
   * (they fall back to no-header behavior, which is safe for non-replayed ops).
   */
  idempotency_key?: string
}

export interface CachedConflict {
  id: string
  entity_type: SyncEntityType
  entity_id: string
  local_data: Record<string, unknown>
  server_data: Record<string, unknown>
  description: string
  resolved: boolean
  resolution: string | null
  created_at: string
  location_id: string
}

export interface CacheMeta {
  id: string
  key: string
  value: string
  updated_at: string
}

// ─── Database definition ───────────────────────────────────────────

class SearOfflineDB extends Dexie {
  menu_categories!: EntityTable<CachedMenuCategory, 'id'>
  menu_items!: EntityTable<CachedMenuItem, 'id'>
  restaurant_tables!: EntityTable<CachedTable, 'id'>
  floor_plans!: EntityTable<CachedFloorPlan, 'id'>
  staff!: EntityTable<CachedStaff, 'id'>
  settings!: EntityTable<CachedSettings, 'id'>
  tax_rates!: EntityTable<CachedTaxRate, 'id'>
  orders!: EntityTable<CachedOrder, 'id'>
  kds_tickets!: EntityTable<CachedKdsTicket, 'id'>
  sync_queue!: EntityTable<SyncQueueEntry, 'id'>
  conflicts!: EntityTable<CachedConflict, 'id'>
  cache_meta!: EntityTable<CacheMeta, 'id'>

  constructor() {
    super('sear-pos-offline')

    this.version(1).stores({
      menu_categories: 'id, location_id, sort_order',
      menu_items: 'id, category_id, location_id, sort_order, is_available',
      restaurant_tables: 'id, floor_plan_id, location_id, status',
      floor_plans: 'id, location_id',
      staff: 'id, location_id, role, is_active',
      settings: 'id, [location_id+key]',
      tax_rates: 'id, location_id, is_active',
      orders: 'id, location_id, status, sync_status, created_at',
      kds_tickets: 'id, order_id, station_id, location_id, sync_status',
      sync_queue: 'id, status, priority, entity_type, entity_id, created_at',
      conflicts: 'id, entity_type, entity_id, resolved, location_id',
      cache_meta: 'id, key',
    })

    // v2: add an index on `idempotency_key` so the replayer can look up by key
    // (V5.3.1). The schema is otherwise identical — `idempotency_key` is added
    // as a regular field on existing entries; Dexie tolerates the absence on
    // legacy rows because indexes are not enforced as NOT NULL.
    this.version(2).stores({
      sync_queue: 'id, status, priority, entity_type, entity_id, created_at, idempotency_key',
    })
  }
}

/** Singleton IndexedDB instance for Sear POS offline storage */
export const offlineDB = new SearOfflineDB()

/**
 * Check IndexedDB storage quota usage.
 * Returns { used, quota, percent } in bytes. Warns at 80%.
 */
export async function checkStorageQuota(): Promise<{
  used: number
  quota: number
  percent: number
  isWarning: boolean
}> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { used: 0, quota: 0, percent: 0, isWarning: false }
  }
  const estimate = await navigator.storage.estimate()
  const used = estimate.usage ?? 0
  const quota = estimate.quota ?? 0
  const percent = quota > 0 ? Math.round((used / quota) * 100) : 0
  return { used, quota, percent, isWarning: percent >= 80 }
}

/**
 * Clear all offline data. Used on logout or when cache is corrupt.
 */
export async function clearAllOfflineData(): Promise<void> {
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
      offlineDB.orders,
      offlineDB.kds_tickets,
      offlineDB.sync_queue,
      offlineDB.conflicts,
      offlineDB.cache_meta,
    ],
    async () => {
      await offlineDB.menu_categories.clear()
      await offlineDB.menu_items.clear()
      await offlineDB.restaurant_tables.clear()
      await offlineDB.floor_plans.clear()
      await offlineDB.staff.clear()
      await offlineDB.settings.clear()
      await offlineDB.tax_rates.clear()
      await offlineDB.orders.clear()
      await offlineDB.kds_tickets.clear()
      await offlineDB.sync_queue.clear()
      await offlineDB.conflicts.clear()
      await offlineDB.cache_meta.clear()
    }
  )
}
