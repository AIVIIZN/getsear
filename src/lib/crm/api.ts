import { createHash } from 'node:crypto'
import type { AuthUser } from '@/lib/api/auth'

export const crmGuestReadRoles = ['platform_admin', 'owner', 'admin', 'manager', 'server', 'bartender', 'cashier', 'host', 'marketing', 'analyst'] as const
export const crmGuestWriteRoles = ['platform_admin', 'owner', 'admin', 'manager', 'server', 'bartender', 'cashier', 'host'] as const
export const crmConsentWriteRoles = ['platform_admin', 'owner', 'admin', 'manager', 'marketing'] as const
export const crmGuestManagerRoles = ['platform_admin', 'owner', 'admin', 'manager'] as const
export const crmGuestOwnerRoles = ['platform_admin', 'owner', 'admin'] as const
export const crmGuestStaffRoles = ['server', 'bartender', 'cashier', 'host'] as const
export const crmGuestRevenueRoles = ['platform_admin', 'owner', 'admin', 'analyst'] as const
export const crmGuestComplianceRoles = ['platform_admin', 'owner', 'admin', 'manager', 'marketing'] as const
export const crmGuestExportRoles = ['platform_admin', 'owner', 'admin'] as const

export type CrmGuestPermissions = {
  can_view_hospitality_notes: boolean
  can_view_recovery_details: boolean
  can_view_revenue_attribution: boolean
  can_view_do_not_contact_reason: boolean
  can_view_internal_manager_notes: boolean
  can_export_guest_data: boolean
}

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

export function getCrmGuestPermissions(user: Pick<AuthUser, 'role'>): CrmGuestPermissions {
  const role = user.role as never
  const isManager = crmGuestManagerRoles.includes(role)
  const isRevenueRole = crmGuestRevenueRoles.includes(role)
  const isComplianceRole = crmGuestComplianceRoles.includes(role)
  const isExportRole = crmGuestExportRoles.includes(role)

  return {
    can_view_hospitality_notes: crmGuestReadRoles.includes(role),
    can_view_recovery_details: isManager,
    can_view_revenue_attribution: isRevenueRole,
    can_view_do_not_contact_reason: isComplianceRole,
    can_view_internal_manager_notes: isManager,
    can_export_guest_data: isExportRole,
  }
}

export function canReadGuestNote(
  user: Pick<AuthUser, 'role'>,
  note: { note_category?: string | null; visibility?: 'service' | 'manager' | 'owner' | string | null },
): boolean {
  const visibility = note.visibility === 'manager' || note.visibility === 'owner' ? note.visibility : 'service'
  if (!canReadGuestVisibility(user, visibility)) return false

  const permissions = getCrmGuestPermissions(user)
  if (note.note_category === 'hospitality') return permissions.can_view_hospitality_notes
  if (note.note_category === 'service_recovery') return permissions.can_view_recovery_details
  if (note.note_category === 'sensitive') return permissions.can_view_internal_manager_notes

  return !crmGuestStaffRoles.includes(user.role as never)
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

function redactRevenueFields(row: Record<string, unknown>): void {
  row.total_spend = null
  row.average_check = null
  row.last_order_id = null
}

function sanitizeSuppressionEntries(value: unknown, permissions: CrmGuestPermissions): unknown {
  if (!Array.isArray(value)) return value
  if (!permissions.can_view_do_not_contact_reason) return []
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry
    const row = { ...(entry as Record<string, unknown>) }
    if (!permissions.can_view_internal_manager_notes) {
      row.proof = null
      row.metadata = {}
    }
    return row
  })
}

export function sanitizeGuestForCrmRole<T extends Record<string, unknown>>(guest: T, user: Pick<AuthUser, 'role'>): T & { crm_permissions: CrmGuestPermissions } {
  const permissions = getCrmGuestPermissions(user)
  const sanitized = { ...guest } as Record<string, unknown> & { crm_permissions: CrmGuestPermissions }

  if (!permissions.can_view_revenue_attribution) {
    redactRevenueFields(sanitized)
  }

  sanitized.suppression_entries = sanitizeSuppressionEntries(sanitized.suppression_entries, permissions)
  if (!permissions.can_view_do_not_contact_reason && sanitized.lifecycle_stage === 'do_not_contact') {
    sanitized.metadata = {}
  }
  if (Array.isArray(sanitized.notes)) {
    sanitized.notes = sanitized.notes.filter((note): note is Record<string, unknown> => {
      return Boolean(note && typeof note === 'object' && canReadGuestNote(user, note as { note_category?: string | null; visibility?: string | null }))
    })
  }
  sanitized.crm_permissions = permissions

  return sanitized as T & { crm_permissions: CrmGuestPermissions }
}

export function sanitizeGuestOrderForCrmRole<T extends Record<string, unknown>>(order: T, user: Pick<AuthUser, 'role'>): T {
  const sanitized = { ...order } as Record<string, unknown>
  if (!getCrmGuestPermissions(user).can_view_revenue_attribution) {
    sanitized.subtotal = null
    sanitized.tax_total = null
    sanitized.total = null
  }
  return sanitized as T
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

export function consentPolicyKey(channel: 'email' | 'sms' | 'push' | 'in_app' | 'phone' | 'mail', purpose: string): string {
  if (channel === 'email' && purpose === 'marketing') return 'email_marketing'
  if (channel === 'sms' && purpose === 'marketing') return 'sms_marketing'
  if (purpose === 'transactional') return 'transactional'
  if (purpose === 'loyalty') return 'loyalty'
  if (purpose === 'reservation') return 'reservation'
  if (purpose === 'feedback') return 'feedback'
  if (purpose === 'personalization') return 'personalization'
  return 'push'
}
