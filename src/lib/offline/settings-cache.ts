/**
 * Location settings, tax rates, and price levels cache.
 */

import { offlineDB, type CachedSettings, type CachedTaxRate } from './db'
import { createClient } from '@/lib/supabase/client'

/**
 * Fetch and cache location settings and tax rates.
 */
export async function syncSettings(
  locationId: string,
  onProgress?: (loaded: number, label: string) => void
): Promise<{ settingsCount: number; taxRateCount: number }> {
  const supabase = createClient()
  const now = new Date().toISOString()

  onProgress?.(0, 'Loading location settings...')

  // Fetch location settings.
  // TODO(supabase-type-gen): location_settings table is not in the public schema yet
  // (V8 onboarding will introduce it). Use an untyped client until the table lands
  // so the typed Database union doesn't reject the relation name.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings, error: settingsError } = await (supabase as any)
    .from('location_settings')
    .select('*')
    .eq('location_id', locationId)

  if (settingsError) throw new Error(`Failed to fetch settings: ${settingsError.message}`)

  // Fetch tax rates
  onProgress?.(40, 'Loading tax rates...')
  const { data: taxRates, error: taxError } = await supabase
    .from('tax_rates')
    .select('*')
    .eq('location_id', locationId)
    .eq('is_active', true)

  if (taxError) throw new Error(`Failed to fetch tax rates: ${taxError.message}`)

  const cachedSettings: CachedSettings[] = ((settings ?? []) as Record<string, unknown>[]).map((s) => ({
    id: s.id as string,
    key: (s.key as string) ?? (s.setting_key as string) ?? '',
    value: typeof s.value === 'string' ? s.value : JSON.stringify(s.value ?? ''),
    location_id: locationId,
    synced_at: now,
  }))

  const cachedTaxRates: CachedTaxRate[] = ((taxRates ?? []) as Record<string, unknown>[]).map((t) => ({
    id: t.id as string,
    name: (t.name as string) ?? '',
    rate: (t.rate as number) ?? 0,
    tax_class: (t.tax_class as string) ?? 'food',
    applies_to_dine_in: (t.applies_to_dine_in as boolean) ?? true,
    applies_to_takeout: (t.applies_to_takeout as boolean) ?? true,
    is_active: (t.is_active as boolean) ?? true,
    location_id: locationId,
    synced_at: now,
  }))

  onProgress?.(75, 'Saving settings to cache...')
  await offlineDB.transaction('rw', [offlineDB.settings, offlineDB.tax_rates], async () => {
    await offlineDB.settings.where('location_id').equals(locationId).delete()
    await offlineDB.tax_rates.where('location_id').equals(locationId).delete()
    if (cachedSettings.length > 0) await offlineDB.settings.bulkPut(cachedSettings)
    if (cachedTaxRates.length > 0) await offlineDB.tax_rates.bulkPut(cachedTaxRates)
  })

  onProgress?.(100, `Settings cached: ${cachedSettings.length} settings, ${cachedTaxRates.length} tax rates`)

  return { settingsCount: cachedSettings.length, taxRateCount: cachedTaxRates.length }
}

/**
 * Get a cached setting value by key.
 */
export async function getCachedSetting(locationId: string, key: string): Promise<string | null> {
  const setting = await offlineDB.settings
    .where('[location_id+key]')
    .equals([locationId, key])
    .first()
  return setting?.value ?? null
}

/**
 * Get all cached settings for a location.
 */
export async function getCachedSettings(locationId: string): Promise<CachedSettings[]> {
  return offlineDB.settings
    .where('location_id')
    .equals(locationId)
    .toArray()
}

/**
 * Get cached tax rates for a location.
 */
export async function getCachedTaxRates(locationId: string): Promise<CachedTaxRate[]> {
  return offlineDB.tax_rates
    .where('location_id')
    .equals(locationId)
    .filter((t) => t.is_active)
    .toArray()
}

/**
 * Get the store-and-forward max amount from cached settings.
 * Default: $200 (20000 cents).
 */
export async function getStoreForwardMaxCents(locationId: string): Promise<number> {
  const value = await getCachedSetting(locationId, 'store_forward_max_cents')
  if (value) {
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return 20000 // $200 default
}
