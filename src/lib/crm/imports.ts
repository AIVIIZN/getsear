import { z } from 'zod'
import { hashGuestContactValue, normalizeGuestContactValue } from '@/lib/crm/api'
import type { createCrmImportJobSchema } from '@/lib/schemas/crm'

type ImportRequest = z.infer<typeof createCrmImportJobSchema>
type ImportMapping = ImportRequest['mapping']

export type CrmImportNormalizedRow = {
  display_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  birthday: string | null
  consent_status: 'granted' | 'revoked' | 'unknown'
  consent_source: string | null
}

export type CrmImportValidationRow = {
  row_number: number
  raw_data: Record<string, unknown>
  normalized_data: CrmImportNormalizedRow
  validation_status: 'valid' | 'invalid' | 'duplicate'
  errors: string[]
  warnings: string[]
  duplicate_guest_id?: string | null
  email_hash?: string | null
  phone_hash?: string | null
}

export type CrmImportValidationSummary = {
  original_row_count: number
  valid_row_count: number
  invalid_row_count: number
  duplicate_row_count: number
  suspicious_row_count: number
}

const emailSchema = z.string().email()
const phoneDigitsSchema = z.string().regex(/^\+?[1-9]\d{7,14}$/)
const birthdaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

function stringCell(row: Record<string, unknown>, key?: string | null): string | null {
  if (!key) return null
  const value = row[key]
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function normalizeConsent(value: string | null): 'granted' | 'revoked' | 'unknown' {
  const normalized = value?.trim().toLowerCase()
  if (['yes', 'y', 'true', '1', 'opted in', 'opt-in', 'subscribed', 'granted'].includes(normalized ?? '')) return 'granted'
  if (['no', 'n', 'false', '0', 'opted out', 'opt-out', 'unsubscribed', 'revoked'].includes(normalized ?? '')) return 'revoked'
  return 'unknown'
}

function hasSuspiciousPayload(row: Record<string, unknown>): boolean {
  return Object.values(row).some((value) => {
    if (typeof value !== 'string') return false
    return /<script|javascript:|onerror=|onload=/i.test(value)
  })
}

export function normalizeCrmImportRow(row: Record<string, unknown>, mapping: ImportMapping): CrmImportNormalizedRow {
  const displayName = stringCell(row, mapping.display_name)
  const firstName = stringCell(row, mapping.first_name)
  const lastName = stringCell(row, mapping.last_name)
  const email = stringCell(row, mapping.email)
  const phone = stringCell(row, mapping.phone)
  const birthday = stringCell(row, mapping.birthday)
  const consentStatus = normalizeConsent(stringCell(row, mapping.consent_status))
  const consentSource = stringCell(row, mapping.consent_source)

  return {
    display_name: displayName ?? ([firstName, lastName].filter(Boolean).join(' ') || null),
    first_name: firstName,
    last_name: lastName,
    email: email ? normalizeGuestContactValue({ contact_type: 'email', value: email }) : null,
    phone: phone ? normalizeGuestContactValue({ contact_type: 'phone', value: phone }) : null,
    birthday,
    consent_status: consentStatus,
    consent_source: consentSource,
  }
}

export function validateCrmImportRows(
  rows: Array<Record<string, unknown>>,
  mapping: ImportMapping,
  options: { duplicateHashes?: Set<string>; requireConsentForMarketing?: boolean } = {},
): { rows: CrmImportValidationRow[]; summary: CrmImportValidationSummary } {
  const duplicateHashes = options.duplicateHashes ?? new Set<string>()
  const seenHashes = new Set<string>()
  let suspiciousRowCount = 0

  const validationRows: CrmImportValidationRow[] = rows.map((row, index) => {
    const normalized = normalizeCrmImportRow(row, mapping)
    const errors: string[] = []
    const warnings: string[] = []
    let emailHash: string | null = null
    let phoneHash: string | null = null

    if (!normalized.display_name) errors.push('missing_name')
    if (normalized.email && !emailSchema.safeParse(normalized.email).success) errors.push('invalid_email')
    if (normalized.phone && !phoneDigitsSchema.safeParse(normalized.phone).success) errors.push('invalid_phone')
    if (!normalized.email && !normalized.phone) errors.push('missing_contact')
    if (normalized.birthday && !birthdaySchema.safeParse(normalized.birthday).success) errors.push('malformed_birthday')
    if (options.requireConsentForMarketing !== false && normalized.consent_status !== 'granted') errors.push('missing_consent')
    if (hasSuspiciousPayload(row)) {
      suspiciousRowCount += 1
      warnings.push('suspicious_data')
    }

    const identityHashes: string[] = []
    if (normalized.email && !errors.includes('invalid_email')) {
      emailHash = hashGuestContactValue(normalized.email)
      identityHashes.push(emailHash)
    }
    if (normalized.phone && !errors.includes('invalid_phone')) {
      phoneHash = hashGuestContactValue(normalized.phone)
      identityHashes.push(phoneHash)
    }

    const isDuplicate = identityHashes.some((hash) => duplicateHashes.has(hash) || seenHashes.has(hash))
    const validationStatus: CrmImportValidationRow['validation_status'] = errors.length > 0 ? 'invalid' : isDuplicate ? 'duplicate' : 'valid'
    for (const hash of identityHashes) seenHashes.add(hash)

    return {
      row_number: index + 1,
      raw_data: row,
      normalized_data: normalized,
      validation_status: validationStatus,
      errors,
      warnings,
      duplicate_guest_id: null,
      email_hash: emailHash,
      phone_hash: phoneHash,
    }
  })

  return {
    rows: validationRows,
    summary: {
      original_row_count: validationRows.length,
      valid_row_count: validationRows.filter((row) => row.validation_status === 'valid').length,
      invalid_row_count: validationRows.filter((row) => row.validation_status === 'invalid').length,
      duplicate_row_count: validationRows.filter((row) => row.validation_status === 'duplicate').length,
      suspicious_row_count: suspiciousRowCount,
    },
  }
}
