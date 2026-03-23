/**
 * Staff roster cache for offline PIN validation and display.
 * PIN hashes are cached for bcrypt validation offline.
 */

import { offlineDB, type CachedStaff } from './db'
import { createClient } from '@/lib/supabase/client'

/**
 * Fetch and cache active staff for a location.
 */
export async function syncStaff(
  locationId: string,
  onProgress?: (loaded: number, label: string) => void
): Promise<{ staffCount: number }> {
  const supabase = createClient()
  const now = new Date().toISOString()

  onProgress?.(0, 'Loading staff roster...')
  const { data: staff, error } = await supabase
    .from('staff')
    .select('id, display_name, email, role, pin_hash, is_active, avatar_color')
    .eq('location_id', locationId)
    .eq('is_active', true)

  if (error) throw new Error(`Failed to fetch staff: ${error.message}`)

  const cachedStaff: CachedStaff[] = ((staff ?? []) as Record<string, unknown>[]).map((s) => ({
    id: s.id as string,
    display_name: (s.display_name as string) ?? '',
    email: (s.email as string) ?? '',
    role: (s.role as string) ?? 'server',
    pin_hash: (s.pin_hash as string | null) ?? null,
    is_active: (s.is_active as boolean) ?? true,
    location_id: locationId,
    avatar_color: (s.avatar_color as string | null) ?? null,
    synced_at: now,
  }))

  onProgress?.(60, 'Saving staff to cache...')
  await offlineDB.transaction('rw', offlineDB.staff, async () => {
    await offlineDB.staff.where('location_id').equals(locationId).delete()
    if (cachedStaff.length > 0) await offlineDB.staff.bulkPut(cachedStaff)
  })

  onProgress?.(100, `Staff cached: ${cachedStaff.length} members`)
  return { staffCount: cachedStaff.length }
}

/**
 * Get cached staff by ID.
 */
export async function getCachedStaffById(staffId: string): Promise<CachedStaff | undefined> {
  return offlineDB.staff.get(staffId)
}

/**
 * Get all cached active staff for a location.
 */
export async function getCachedStaff(locationId: string): Promise<CachedStaff[]> {
  return offlineDB.staff
    .where('location_id')
    .equals(locationId)
    .toArray()
}

/**
 * Validate a staff PIN offline using bcrypt.
 * Returns the staff member if valid, null if invalid.
 */
export async function validatePinOffline(
  locationId: string,
  pin: string
): Promise<CachedStaff | null> {
  // Dynamic import bcryptjs for browser usage
  const { compare } = await import('bcryptjs')

  const staffList = await offlineDB.staff
    .where('location_id')
    .equals(locationId)
    .filter((s) => s.is_active && s.pin_hash !== null)
    .toArray()

  for (const staff of staffList) {
    if (!staff.pin_hash) continue
    const match = await compare(pin, staff.pin_hash)
    if (match) return staff
  }

  return null
}

/**
 * Validate a specific staff member's PIN offline.
 * Used for manager override validation.
 */
export async function validateStaffPinOffline(
  staffId: string,
  pin: string
): Promise<boolean> {
  const { compare } = await import('bcryptjs')
  const staff = await offlineDB.staff.get(staffId)
  if (!staff?.pin_hash) return false
  return compare(pin, staff.pin_hash)
}

/**
 * Check if a staff member has a manager-level role (for overrides).
 */
export async function isManagerRole(staffId: string): Promise<boolean> {
  const staff = await offlineDB.staff.get(staffId)
  if (!staff) return false
  return ['owner', 'admin', 'manager'].includes(staff.role)
}
