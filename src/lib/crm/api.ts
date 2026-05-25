import { createHash } from 'node:crypto'
import type { AuthUser } from '@/lib/api/auth'

export const crmGuestReadRoles = ['platform_admin', 'owner', 'admin', 'manager', 'server', 'bartender', 'cashier', 'host', 'marketing', 'analyst'] as const
export const crmGuestWriteRoles = ['platform_admin', 'owner', 'admin', 'manager', 'server', 'bartender', 'cashier', 'host'] as const
export const crmGuestManagerRoles = ['platform_admin', 'owner', 'admin', 'manager'] as const
export const crmGuestOwnerRoles = ['platform_admin', 'owner', 'admin'] as const

export type GuestContactInput = {
  contact_type: 'email' | 'phone' | 'address' | 'social' | 'reservation' | 'delivery' | 'other'
  value: string
}

export function normalizeGuestContactValue(contact: GuestContactInput): string {
  const trimmed = contact.value.trim()
  if (contact.contact_type === 'email') {
    return trimmed.toLowerCase()
  }

  if (contact.contact_type === 'phone') {
    const digits = trimmed.replace(/\D/g, '')
    if (digits.length === 10) return `+1${digits}`
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
    return digits ? `+${digits}` : trimmed
  }

  return trimmed.replace(/\s+/g, ' ')
}

export function hashGuestContactValue(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function escapePostgrestLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export function canReadGuestVisibility(user: Pick<AuthUser, 'role'>, visibility: 'service' | 'manager' | 'owner'): boolean {
  if (visibility === 'service') return true
  if (visibility === 'manager') return crmGuestManagerRoles.includes(user.role as never)
  return crmGuestOwnerRoles.includes(user.role as never)
}

export function canWriteGuestVisibility(user: Pick<AuthUser, 'role'>, visibility: 'service' | 'manager' | 'owner'): boolean {
  return canReadGuestVisibility(user, visibility)
}

export function noteVisibilityFilter(user: Pick<AuthUser, 'role'>): string {
  if (crmGuestOwnerRoles.includes(user.role as never)) {
    return 'visibility.in.(service,manager,owner)'
  }
  if (crmGuestManagerRoles.includes(user.role as never)) {
    return 'visibility.in.(service,manager)'
  }
  return 'visibility.eq.service'
}

export function buildGuestDisplayName(input: {
  display_name?: string | null
  first_name?: string | null
  last_name?: string | null
  preferred_name?: string | null
}): string {
  const explicit = input.display_name?.trim()
  if (explicit) return explicit
  const preferred = input.preferred_name?.trim()
  if (preferred) return preferred
  const name = [input.first_name, input.last_name].map((part) => part?.trim()).filter(Boolean).join(' ')
  return name || 'Guest'
}
