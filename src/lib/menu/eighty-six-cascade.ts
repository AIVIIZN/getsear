/**
 * 86 Cascade Engine.
 *
 * Handles ingredient-level 86 with cascade to affected menu items,
 * Supabase Realtime broadcast, and audit logging.
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CascadeItem {
  item_id: string
  item_name: string
  category_name: string
  is_minor_ingredient: boolean
  quantity_used: string
  unit_of_measure: string
}

export interface EightySixLogEntry {
  id: string
  ingredient_id: string | null
  ingredient_name: string | null
  item_id: string
  item_name: string
  action: '86' | 'restore'
  performed_by_name: string
  reason: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// getCascadePreview
// ---------------------------------------------------------------------------

/**
 * Given an inventory ingredient ID, looks up all menu items that use it
 * (via the recipes junction table) and returns a preview of what would
 * be affected by an 86 cascade.
 */
export async function getCascadePreview(
  ingredientId: string,
  orgId: string
): Promise<CascadeItem[]> {
  const supabase = createAdminClient()

  // Query recipes joining menu_items and menu_categories
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('recipes') as any)
    .select(`
      menu_item_id,
      quantity_used,
      unit_of_measure,
      menu_items!inner (
        id,
        name,
        is_86d,
        deleted_at,
        category_id,
        menu_categories!inner ( name )
      )
    `)
    .eq('inventory_item_id', ingredientId)
    .eq('org_id', orgId)

  if (error || !data) {
    console.error('getCascadePreview error:', error)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .filter((r) => r.menu_items && !r.menu_items.deleted_at)
    .map((r) => ({
      item_id: r.menu_items.id as string,
      item_name: r.menu_items.name as string,
      category_name: r.menu_items.menu_categories?.name ?? 'Uncategorized',
      // Heuristic: if quantity_used is below 0.5 of the base unit, flag as minor
      is_minor_ingredient: parseFloat(r.quantity_used) < 0.5,
      quantity_used: r.quantity_used as string,
      unit_of_measure: r.unit_of_measure as string,
    }))
}

// ---------------------------------------------------------------------------
// apply86Cascade
// ---------------------------------------------------------------------------

/**
 * 86 an ingredient and cascade to the specified menu items.
 *
 * Steps:
 * 1. Mark the inventory_item as depleted (current_quantity = 0)
 * 2. Set is_86d = true on all specified menu items
 * 3. Log each 86 action to eighty_six_log
 * 4. Broadcast via Supabase Realtime so all terminals update within 3s
 */
export async function apply86Cascade(
  ingredientId: string,
  itemIds: string[],
  userId: string,
  orgId: string,
  locationId: string,
  reason?: string
): Promise<{ success: boolean; affectedCount: number; error?: string }> {
  if (itemIds.length === 0) {
    return { success: true, affectedCount: 0 }
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // 1. Mark ingredient quantity to 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('inventory_items') as any)
    .update({ current_quantity: 0, updated_at: now })
    .eq('id', ingredientId)
    .eq('org_id', orgId)

  // 2. 86 all specified menu items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase.from('menu_items') as any)
    .update({ is_86d: true, updated_at: now })
    .in('id', itemIds)
    .eq('org_id', orgId)

  if (updateError) {
    console.error('apply86Cascade update error:', updateError)
    return { success: false, affectedCount: 0, error: updateError.message }
  }

  // 3. Get ingredient and item names for logging
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ingredient } = await (supabase.from('inventory_items') as any)
    .select('name')
    .eq('id', ingredientId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (supabase.from('menu_items') as any)
    .select('id, name')
    .in('id', itemIds)

  // 4. Insert log entries
  const logEntries = (items ?? []).map((item: { id: string; name: string }) => ({
    org_id: orgId,
    location_id: locationId,
    ingredient_id: ingredientId,
    item_id: item.id,
    action: '86' as const,
    performed_by: userId,
    reason: reason ?? `Ingredient 86: ${ingredient?.name ?? ingredientId}`,
    created_at: now,
  }))

  if (logEntries.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('eighty_six_log') as any).insert(logEntries)
  }

  // 5. Broadcast via Realtime channel
  const channel = supabase.channel(`86:${locationId}`)
  await channel.send({
    type: 'broadcast',
    event: '86_cascade',
    payload: {
      ingredient_id: ingredientId,
      ingredient_name: ingredient?.name ?? 'Unknown',
      item_ids: itemIds,
      item_names: (items ?? []).map((i: { name: string }) => i.name),
      action: '86',
      performed_by: userId,
      timestamp: now,
    },
  })
  supabase.removeChannel(channel)

  return { success: true, affectedCount: itemIds.length }
}

// ---------------------------------------------------------------------------
// un86Ingredient
// ---------------------------------------------------------------------------

/**
 * Restore an ingredient and all menu items that were 86'd by it.
 *
 * Looks at eighty_six_log to find items that were 86'd due to this
 * ingredient and haven't been individually restored yet.
 */
export async function un86Ingredient(
  ingredientId: string,
  userId: string,
  orgId: string,
  locationId: string
): Promise<{ success: boolean; restoredCount: number; error?: string }> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Find all items 86'd by this ingredient that haven't been restored
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: logEntries } = await (supabase.from('eighty_six_log') as any)
    .select('item_id')
    .eq('ingredient_id', ingredientId)
    .eq('org_id', orgId)
    .eq('action', '86')

  if (!logEntries || logEntries.length === 0) {
    return { success: true, restoredCount: 0 }
  }

  // Get unique item IDs that were 86'd by this ingredient
  // Check which are currently still 86'd
  const itemIds = [...new Set(logEntries.map((e: { item_id: string }) => e.item_id))]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: still86d } = await (supabase.from('menu_items') as any)
    .select('id, name')
    .in('id', itemIds)
    .eq('is_86d', true)
    .eq('org_id', orgId)

  if (!still86d || still86d.length === 0) {
    return { success: true, restoredCount: 0 }
  }

  const restoreIds = still86d.map((i: { id: string }) => i.id)

  // Restore all items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase.from('menu_items') as any)
    .update({ is_86d: false, updated_at: now })
    .in('id', restoreIds)
    .eq('org_id', orgId)

  if (updateError) {
    return { success: false, restoredCount: 0, error: updateError.message }
  }

  // Log restore entries
  const restoreLogs = still86d.map((item: { id: string; name: string }) => ({
    org_id: orgId,
    location_id: locationId,
    ingredient_id: ingredientId,
    item_id: item.id,
    action: 'restore' as const,
    performed_by: userId,
    reason: 'Ingredient restored',
    created_at: now,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('eighty_six_log') as any).insert(restoreLogs)

  // Get ingredient name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ingredient } = await (supabase.from('inventory_items') as any)
    .select('name')
    .eq('id', ingredientId)
    .single()

  // Broadcast restore
  const channel = supabase.channel(`86:${locationId}`)
  await channel.send({
    type: 'broadcast',
    event: '86_cascade',
    payload: {
      ingredient_id: ingredientId,
      ingredient_name: ingredient?.name ?? 'Unknown',
      item_ids: restoreIds,
      item_names: still86d.map((i: { name: string }) => i.name),
      action: 'restore',
      performed_by: userId,
      timestamp: now,
    },
  })
  supabase.removeChannel(channel)

  return { success: true, restoredCount: restoreIds.length }
}

// ---------------------------------------------------------------------------
// getEightySixLog
// ---------------------------------------------------------------------------

/**
 * Fetch the 86 tracking log for a location, most recent first.
 */
export async function getEightySixLog(
  orgId: string,
  locationId: string,
  limit: number = 50
): Promise<EightySixLogEntry[]> {
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('eighty_six_log') as any)
    .select(`
      id,
      ingredient_id,
      item_id,
      action,
      performed_by,
      reason,
      created_at,
      menu_items!inner ( name ),
      users!eighty_six_log_performed_by_fkey ( first_name, last_name )
    `)
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    console.error('getEightySixLog error:', error)
    return []
  }

  // Batch fetch ingredient names for entries that have ingredient_id
  const ingredientIds = [
    ...new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data as any[])
        .filter((e) => e.ingredient_id)
        .map((e) => e.ingredient_id as string)
    ),
  ]

  let ingredientNames: Record<string, string> = {}
  if (ingredientIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ingredients } = await (supabase.from('inventory_items') as any)
      .select('id, name')
      .in('id', ingredientIds)

    if (ingredients) {
      ingredientNames = Object.fromEntries(
        (ingredients as { id: string; name: string }[]).map((i) => [i.id, i.name])
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((entry) => ({
    id: entry.id as string,
    ingredient_id: entry.ingredient_id as string | null,
    ingredient_name: entry.ingredient_id
      ? ingredientNames[entry.ingredient_id] ?? null
      : null,
    item_id: entry.item_id as string,
    item_name: entry.menu_items?.name ?? 'Unknown',
    action: entry.action as '86' | 'restore',
    performed_by_name: entry.users
      ? `${entry.users.first_name} ${entry.users.last_name}`
      : 'System',
    reason: entry.reason as string | null,
    created_at: entry.created_at as string,
  }))
}

// ---------------------------------------------------------------------------
// getCurrent86dIngredients
// ---------------------------------------------------------------------------

/**
 * Get all inventory items that are currently at 0 quantity (effectively 86'd)
 * for a given location.
 */
export async function getCurrent86dIngredients(
  orgId: string,
  locationId: string
): Promise<{ id: string; name: string; category: string | null }[]> {
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('inventory_items') as any)
    .select('id, name, category')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .lte('current_quantity', 0)
    .eq('is_active', true)

  if (error) {
    console.error('getCurrent86dIngredients error:', error)
    return []
  }

  return (data ?? []) as { id: string; name: string; category: string | null }[]
}
