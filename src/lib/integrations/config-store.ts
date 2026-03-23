/**
 * Integration Config Store
 *
 * Encrypted storage for third-party integration credentials.
 * Uses AES-256-GCM for application-level encryption before persisting to Supabase.
 * Only the last 4 characters of sensitive values are exposed in API responses.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY ?? 'sear-pos-default-key-change-me!!'
const ALGORITHM = 'aes-256-gcm'

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, 'sear-pos-salt', 32)
}

export function encrypt(text: string): string {
  const key = deriveKey(ENCRYPTION_KEY)
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
  const key = deriveKey(ENCRYPTION_KEY)
  const parts = encryptedText.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted format')
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export function maskSecret(value: string): string {
  if (!value || value.length <= 4) return '****'
  return '*'.repeat(value.length - 4) + value.slice(-4)
}

export type IntegrationProvider = 'twilio' | 'sendgrid' | 'quickbooks' | 'webhooks'

export interface IntegrationConfig {
  id: string
  location_id: string
  provider: IntegrationProvider
  is_active: boolean
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

/** Sensitive fields that should be encrypted before storage */
const SENSITIVE_FIELDS: Record<IntegrationProvider, string[]> = {
  twilio: ['auth_token'],
  sendgrid: ['api_key'],
  quickbooks: ['access_token', 'refresh_token', 'client_secret'],
  webhooks: ['secret'],
}

function encryptSensitiveFields(
  provider: IntegrationProvider,
  config: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...config }
  const fields = SENSITIVE_FIELDS[provider] ?? []
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string' && !(result[field] as string).includes(':')) {
      result[field] = encrypt(result[field] as string)
    }
  }
  return result
}

function decryptSensitiveFields(
  provider: IntegrationProvider,
  config: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...config }
  const fields = SENSITIVE_FIELDS[provider] ?? []
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      try {
        result[field] = decrypt(result[field] as string)
      } catch {
        // Already decrypted or invalid — leave as is
      }
    }
  }
  return result
}

export function maskSensitiveFields(
  provider: IntegrationProvider,
  config: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...config }
  const fields = SENSITIVE_FIELDS[provider] ?? []
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = maskSecret(result[field] as string)
    }
  }
  return result
}

/**
 * Get integration config for a location + provider.
 * Returns decrypted config for server-side use.
 */
export async function getIntegrationConfig(
  locationId: string,
  provider: IntegrationProvider
): Promise<IntegrationConfig | null> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('integration_configs') as any)
    .select('*')
    .eq('location_id', locationId)
    .eq('provider', provider)
    .maybeSingle()

  if (error || !data) return null

  return {
    ...data,
    config: decryptSensitiveFields(provider, data.config ?? {}),
  }
}

/**
 * Get integration config with masked secrets for API responses.
 */
export async function getIntegrationConfigMasked(
  locationId: string,
  provider: IntegrationProvider
): Promise<(IntegrationConfig & { config: Record<string, unknown> }) | null> {
  const raw = await getIntegrationConfig(locationId, provider)
  if (!raw) return null
  return {
    ...raw,
    config: maskSensitiveFields(provider, raw.config),
  }
}

/**
 * Upsert integration config for a location + provider.
 * Encrypts sensitive fields before storing.
 */
export async function saveIntegrationConfig(
  locationId: string,
  provider: IntegrationProvider,
  config: Record<string, unknown>,
  isActive: boolean = true
): Promise<IntegrationConfig | null> {
  const supabase = createAdminClient()
  const encryptedConfig = encryptSensitiveFields(provider, config)

  // Check if config exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('integration_configs') as any)
    .select('id, config')
    .eq('location_id', locationId)
    .eq('provider', provider)
    .maybeSingle()

  if (existing) {
    // Merge: preserve existing encrypted values for fields sent as masked
    const mergedConfig = { ...existing.config }
    for (const [key, value] of Object.entries(encryptedConfig)) {
      if (typeof value === 'string' && value.startsWith('*')) {
        // This is a masked value — keep the existing encrypted value
        continue
      }
      mergedConfig[key] = value
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('integration_configs') as any)
      .update({
        config: mergedConfig,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) throw new Error(`Failed to update config: ${error.message}`)
    return data
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('integration_configs') as any)
    .insert({
      location_id: locationId,
      provider,
      config: encryptedConfig,
      is_active: isActive,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to save config: ${error.message}`)
  return data
}

/**
 * Check if a provider is configured and active for a location.
 * Useful for graceful degradation — silently skip if not configured.
 */
export async function isIntegrationActive(
  locationId: string,
  provider: IntegrationProvider
): Promise<boolean> {
  const config = await getIntegrationConfig(locationId, provider)
  return config !== null && config.is_active
}

/**
 * Check rate limit for a provider at a location.
 * Returns true if under the limit.
 */
export async function checkRateLimit(
  locationId: string,
  provider: 'sms' | 'email' | 'webhook',
  dailyLimit: number
): Promise<boolean> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const tableMap: Record<string, string> = {
    sms: 'sms_delivery_log',
    email: 'email_delivery_log',
    webhook: 'webhook_delivery_log',
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabase.from(tableMap[provider]) as any)
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .gte('created_at', `${today}T00:00:00Z`)

  if (error) return false
  return (count ?? 0) < dailyLimit
}
