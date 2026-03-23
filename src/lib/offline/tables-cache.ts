/**
 * Tables and floor plan cache for offline mode.
 */

import { offlineDB, type CachedTable, type CachedFloorPlan } from './db'
import { createClient } from '@/lib/supabase/client'

/**
 * Fetch and cache all tables and floor plans for a location.
 */
export async function syncTables(
  locationId: string,
  onProgress?: (loaded: number, label: string) => void
): Promise<{ tableCount: number; floorPlanCount: number }> {
  const supabase = createClient()
  const now = new Date().toISOString()

  onProgress?.(0, 'Loading floor plans...')
  const { data: floorPlans, error: fpError } = await supabase
    .from('floor_plans')
    .select('*')
    .eq('location_id', locationId)

  if (fpError) throw new Error(`Failed to fetch floor plans: ${fpError.message}`)

  onProgress?.(30, 'Loading tables...')
  const { data: tables, error: tError } = await supabase
    .from('tables')
    .select('*')
    .eq('location_id', locationId)

  if (tError) throw new Error(`Failed to fetch tables: ${tError.message}`)

  const cachedFloorPlans: CachedFloorPlan[] = ((floorPlans ?? []) as Record<string, unknown>[]).map((fp) => ({
    id: fp.id as string,
    name: fp.name as string,
    is_default: (fp.is_default as boolean) ?? false,
    location_id: locationId,
    synced_at: now,
  }))

  const cachedTables: CachedTable[] = ((tables ?? []) as Record<string, unknown>[]).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    section: (t.section as string) ?? '',
    status: (t.status as string) ?? 'available',
    capacity: (t.capacity as number) ?? 4,
    position_x: (t.position_x as number) ?? 0,
    position_y: (t.position_y as number) ?? 0,
    shape: (t.shape as CachedTable['shape']) ?? { type: 'square', width: 80, height: 80 },
    current_order_id: (t.current_order_id as string | null) ?? null,
    current_server_id: (t.current_server_id as string | null) ?? null,
    current_server_name: (t.current_server_name as string | null) ?? null,
    guest_count: (t.guest_count as number) ?? 0,
    seated_at: (t.seated_at as string | null) ?? null,
    floor_plan_id: t.floor_plan_id as string,
    location_id: locationId,
    synced_at: now,
  }))

  onProgress?.(70, 'Saving tables to cache...')
  await offlineDB.transaction('rw', [offlineDB.restaurant_tables, offlineDB.floor_plans], async () => {
    await offlineDB.floor_plans.where('location_id').equals(locationId).delete()
    await offlineDB.restaurant_tables.where('location_id').equals(locationId).delete()
    if (cachedFloorPlans.length > 0) await offlineDB.floor_plans.bulkPut(cachedFloorPlans)
    if (cachedTables.length > 0) await offlineDB.restaurant_tables.bulkPut(cachedTables)
  })

  onProgress?.(100, `Tables cached: ${cachedTables.length} tables, ${cachedFloorPlans.length} floor plans`)

  return { tableCount: cachedTables.length, floorPlanCount: cachedFloorPlans.length }
}

/**
 * Get cached tables for a location.
 */
export async function getCachedTables(locationId: string): Promise<CachedTable[]> {
  return offlineDB.restaurant_tables
    .where('location_id')
    .equals(locationId)
    .toArray()
}

/**
 * Get cached floor plans for a location.
 */
export async function getCachedFloorPlans(locationId: string): Promise<CachedFloorPlan[]> {
  return offlineDB.floor_plans
    .where('location_id')
    .equals(locationId)
    .toArray()
}

/**
 * Update a single table in the cache.
 */
export async function updateTableInCache(tableId: string, updates: Partial<CachedTable>): Promise<void> {
  await offlineDB.restaurant_tables.update(tableId, { ...updates, synced_at: new Date().toISOString() })
}
