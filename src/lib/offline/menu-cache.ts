/**
 * Menu cache: Full menu sync on login, incremental updates via Realtime.
 * Stores categories, items (with modifiers, allergens, 86 status, combo slots).
 */

import { offlineDB, type CachedMenuCategory, type CachedMenuItem } from './db'
import { createClient } from '@/lib/supabase/client'

/**
 * Fetch and cache the complete menu for a location.
 * Called during cache warm on login.
 */
export async function syncFullMenu(
  locationId: string,
  onProgress?: (loaded: number, label: string) => void
): Promise<{ categoryCount: number; itemCount: number }> {
  const supabase = createClient()
  const now = new Date().toISOString()

  // Fetch categories
  onProgress?.(0, 'Loading menu categories...')
  const { data: categories, error: catError } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .order('sort_order')

  if (catError) throw new Error(`Failed to fetch categories: ${catError.message}`)

  const cachedCategories: CachedMenuCategory[] = (categories ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    name: c.name as string,
    color: (c.color as string) ?? '#6B7280',
    sort_order: (c.sort_order as number) ?? 0,
    is_active: (c.is_active as boolean) ?? true,
    item_count: (c.item_count as number) ?? 0,
    location_id: locationId,
    synced_at: now,
  }))

  // Fetch items with modifier groups embedded
  onProgress?.(30, 'Loading menu items...')
  const { data: items, error: itemError } = await supabase
    .from('menu_items')
    .select(`
      *,
      menu_item_modifier_groups(
        modifier_group:modifier_groups(
          id, name, is_required, min_selections, max_selections,
          modifiers(id, name, price_cents, is_available, sort_order)
        )
      ),
      menu_item_allergens(allergen:allergens(name)),
      combo_slots:combo_group_slots(
        id, name, sort_order,
        options:combo_slot_options(
          id, menu_item_id, name, upcharge_cents, is_default
        )
      )
    `)
    .eq('location_id', locationId)
    .order('sort_order')

  if (itemError) throw new Error(`Failed to fetch menu items: ${itemError.message}`)

  onProgress?.(60, `Processing ${(items as Record<string, unknown>[] | null)?.length ?? 0} menu items...`)

  const cachedItems: CachedMenuItem[] = ((items ?? []) as Record<string, unknown>[]).map((item) => {
    // Extract modifier groups from join table
    const rawModGroups = (item.menu_item_modifier_groups as Record<string, unknown>[] | undefined) ?? []
    const modifierGroups = rawModGroups
      .map((mig) => mig.modifier_group as CachedMenuItem['modifier_groups'][number] | null)
      .filter(Boolean) as CachedMenuItem['modifier_groups']

    // Extract allergens
    const rawAllergens = (item.menu_item_allergens as Record<string, unknown>[] | undefined) ?? []
    const allergens = rawAllergens
      .map((a) => {
        const allergen = a.allergen as { name: string } | null
        return allergen?.name
      })
      .filter(Boolean) as string[]

    // Extract combo slots
    const rawSlots = (item.combo_slots as Record<string, unknown>[] | undefined) ?? []
    const comboSlots = rawSlots.map((slot) => ({
      id: slot.id as string,
      name: slot.name as string,
      sort_order: (slot.sort_order as number) ?? 0,
      options: ((slot.options as Record<string, unknown>[]) ?? []).map((opt) => ({
        id: opt.id as string,
        menu_item_id: opt.menu_item_id as string,
        name: opt.name as string,
        upcharge_cents: (opt.upcharge_cents as number) ?? 0,
        is_default: (opt.is_default as boolean) ?? false,
        modifier_groups: [] as CachedMenuItem['modifier_groups'],
      })),
    }))

    return {
      id: item.id as string,
      name: item.name as string,
      description: (item.description as string) ?? '',
      price_cents: (item.price_cents as number) ?? 0,
      category_id: item.category_id as string,
      is_available: (item.is_available as boolean) ?? true,
      is_taxable: (item.is_taxable as boolean) ?? true,
      sort_order: (item.sort_order as number) ?? 0,
      image_url: (item.image_url as string | null) ?? null,
      allergens,
      modifier_groups: modifierGroups,
      price_type: (item.price_type as string) ?? 'fixed',
      min_price_cents: (item.min_price_cents as number | null) ?? null,
      max_price_cents: (item.max_price_cents as number | null) ?? null,
      combo_group_id: (item.combo_group_id as string | null) ?? null,
      combo_name: (item.combo_name as string | null) ?? null,
      combo_price_cents: (item.combo_price_cents as number | null) ?? null,
      combo_slots: comboSlots,
      tax_class: (item.tax_class as string) ?? 'food',
      location_id: locationId,
      synced_at: now,
    }
  })

  // Write to IndexedDB in a transaction
  onProgress?.(80, 'Saving to local cache...')
  await offlineDB.transaction('rw', [offlineDB.menu_categories, offlineDB.menu_items], async () => {
    // Clear old data for this location
    await offlineDB.menu_categories.where('location_id').equals(locationId).delete()
    await offlineDB.menu_items.where('location_id').equals(locationId).delete()
    // Bulk insert
    if (cachedCategories.length > 0) await offlineDB.menu_categories.bulkPut(cachedCategories)
    if (cachedItems.length > 0) await offlineDB.menu_items.bulkPut(cachedItems)
  })

  onProgress?.(100, `Menu cached: ${cachedCategories.length} categories, ${cachedItems.length} items`)

  return { categoryCount: cachedCategories.length, itemCount: cachedItems.length }
}

/**
 * Get all cached menu categories for a location.
 */
export async function getCachedCategories(locationId: string): Promise<CachedMenuCategory[]> {
  return offlineDB.menu_categories
    .where('location_id')
    .equals(locationId)
    .sortBy('sort_order')
}

/**
 * Get all cached menu items for a location.
 */
export async function getCachedMenuItems(locationId: string): Promise<CachedMenuItem[]> {
  return offlineDB.menu_items
    .where('location_id')
    .equals(locationId)
    .toArray()
}

/**
 * Update 86 status for a specific item in the cache.
 */
export async function update86StatusInCache(itemId: string, isAvailable: boolean): Promise<void> {
  await offlineDB.menu_items.update(itemId, { is_available: isAvailable, synced_at: new Date().toISOString() })
}

/**
 * Update a single menu item in the cache (for Realtime incremental updates).
 */
export async function updateMenuItemInCache(itemId: string, updates: Partial<CachedMenuItem>): Promise<void> {
  await offlineDB.menu_items.update(itemId, { ...updates, synced_at: new Date().toISOString() })
}

/**
 * Check if menu cache exists and is recent enough.
 */
export async function isMenuCacheFresh(locationId: string, maxAgeMs: number = 4 * 60 * 60 * 1000): Promise<boolean> {
  const item = await offlineDB.menu_items
    .where('location_id')
    .equals(locationId)
    .first()

  if (!item) return false
  const age = Date.now() - new Date(item.synced_at).getTime()
  return age < maxAgeMs
}
