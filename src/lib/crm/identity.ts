import { hashGuestContactValue, normalizeGuestContactValue } from '@/lib/crm/api'

export type IdentityGuest = {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  location_id: string | null
  lifecycle_stage: string
  total_visits: number | null
  total_spend: string | number | null
  guest_contact_points?: IdentityContactPoint[]
  guest_identifiers?: IdentityIdentifier[]
}

export type IdentityContactPoint = {
  contact_type: string
  value: string
  normalized_value: string | null
  value_hash: string
  is_verified: boolean
}

export type IdentityIdentifier = {
  identifier_type: string
  provider: string | null
  display_value: string | null
  value_hash: string
  is_primary: boolean
}

export type IdentityEvidence = {
  signal: string
  label: string
  detail: string
  weight: number
}

export type IdentityCandidate = {
  primary_guest_id: string
  candidate_guest_id: string
  confidence: number
  confidence_level: '100' | '90' | '75' | '50' | 'below_50'
  signals: string[]
  evidence: IdentityEvidence[]
}

function normalizedName(guest: IdentityGuest): string {
  return [guest.first_name, guest.last_name].filter(Boolean).join(' ').trim().toLowerCase()
    || guest.display_name.trim().toLowerCase()
}

function phoneLastFour(contact: IdentityContactPoint): string | null {
  if (contact.contact_type !== 'phone') return null
  const digits = (contact.normalized_value ?? contact.value).replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}

function emailDomain(contact: IdentityContactPoint): string | null {
  if (contact.contact_type !== 'email') return null
  const value = (contact.normalized_value ?? contact.value).toLowerCase()
  return value.includes('@') ? value.split('@').pop() ?? null : null
}

function confidenceLevel(confidence: number): IdentityCandidate['confidence_level'] {
  if (confidence >= 100) return '100'
  if (confidence >= 90) return '90'
  if (confidence >= 75) return '75'
  if (confidence >= 50) return '50'
  return 'below_50'
}

function addEvidence(evidence: IdentityEvidence[], signal: string, label: string, detail: string, weight: number) {
  if (!evidence.some((item) => item.signal === signal && item.detail === detail)) {
    evidence.push({ signal, label, detail, weight })
  }
}

export function buildIdentityCandidates(guests: IdentityGuest[]): IdentityCandidate[] {
  const candidates: IdentityCandidate[] = []

  for (let i = 0; i < guests.length; i += 1) {
    for (let j = i + 1; j < guests.length; j += 1) {
      const left = guests[i]!
      const right = guests[j]!
      const evidence: IdentityEvidence[] = []
      const leftContacts = left.guest_contact_points ?? []
      const rightContacts = right.guest_contact_points ?? []
      const leftIdentifiers = left.guest_identifiers ?? []
      const rightIdentifiers = right.guest_identifiers ?? []

      for (const contact of leftContacts) {
        for (const other of rightContacts) {
          if (contact.contact_type !== other.contact_type) continue
          const contactHash = contact.value_hash || hashGuestContactValue(normalizeGuestContactValue({
            contact_type: contact.contact_type as never,
            value: contact.normalized_value ?? contact.value,
          }))
          const otherHash = other.value_hash || hashGuestContactValue(normalizeGuestContactValue({
            contact_type: other.contact_type as never,
            value: other.normalized_value ?? other.value,
          }))
          if (contactHash === otherHash && contactHash) {
            if (contact.contact_type === 'email' && contact.is_verified && other.is_verified) {
              addEvidence(evidence, 'verified_email', 'Verified email', 'Both profiles share a verified email.', 100)
            } else if (contact.contact_type === 'phone' && contact.is_verified && other.is_verified) {
              addEvidence(evidence, 'verified_phone', 'Verified phone', 'Both profiles share a verified phone.', 100)
            } else if (contact.contact_type === 'phone') {
              addEvidence(evidence, 'normalized_phone', 'Normalized phone', 'Both profiles share the same normalized phone.', 90)
            } else if (contact.contact_type === 'email') {
              addEvidence(evidence, 'email', 'Email', 'Both profiles share the same email.', 90)
            } else if (['reservation', 'delivery'].includes(contact.contact_type)) {
              addEvidence(evidence, `${contact.contact_type}_contact`, 'Reservation or delivery contact', `Both profiles share a ${contact.contact_type} contact.`, 75)
            }
          }
        }
      }

      for (const identifier of leftIdentifiers) {
        for (const other of rightIdentifiers) {
          if (identifier.identifier_type === other.identifier_type && identifier.provider === other.provider && identifier.value_hash === other.value_hash) {
            const weight = identifier.identifier_type === 'loyalty_id' ? 100 : 90
            const label = identifier.identifier_type.replaceAll('_', ' ')
            addEvidence(evidence, identifier.identifier_type, label, `Both profiles share ${label}.`, weight)
          }
        }
      }

      const namesMatch = normalizedName(left) === normalizedName(right)
      if (namesMatch) {
        const leftLastFour = leftContacts.map(phoneLastFour).find(Boolean)
        const rightLastFour = rightContacts.map(phoneLastFour).find(Boolean)
        const leftDomain = leftContacts.map(emailDomain).find(Boolean)
        const rightDomain = rightContacts.map(emailDomain).find(Boolean)
        if (leftLastFour && rightLastFour && leftLastFour === rightLastFour) {
          addEvidence(evidence, 'name_phone_hint', 'Name plus phone hint', 'Names match and phone last four matches.', 50)
        } else if (leftDomain && rightDomain && leftDomain === rightDomain) {
          addEvidence(evidence, 'name_email_domain_hint', 'Name plus email domain', 'Names match and email domain matches.', 50)
        }
      }

      const confidence = Math.min(100, evidence.reduce((max, item) => Math.max(max, item.weight), 0))
      if (confidence >= 50) {
        candidates.push({
          primary_guest_id: left.id < right.id ? left.id : right.id,
          candidate_guest_id: left.id < right.id ? right.id : left.id,
          confidence,
          confidence_level: confidenceLevel(confidence),
          signals: evidence.map((item) => item.signal),
          evidence,
        })
      }
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence)
}
