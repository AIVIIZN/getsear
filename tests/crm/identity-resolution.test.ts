import { describe, expect, it } from 'vitest'
import { buildIdentityCandidates, type IdentityGuest } from '@/lib/crm/identity'
import { hashGuestContactValue } from '@/lib/crm/api'

function guest(overrides: Partial<IdentityGuest>): IdentityGuest {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    display_name: overrides.display_name ?? 'Guest',
    first_name: overrides.first_name ?? null,
    last_name: overrides.last_name ?? null,
    location_id: null,
    lifecycle_stage: 'unknown',
    total_visits: 0,
    total_spend: 0,
    guest_contact_points: overrides.guest_contact_points ?? [],
    guest_identifiers: overrides.guest_identifiers ?? [],
  }
}

describe('CRM identity resolution', () => {
  it('scores verified shared email as a certain duplicate candidate', () => {
    const hash = hashGuestContactValue('alex@example.com')
    const candidates = buildIdentityCandidates([
      guest({
        id: '00000000-0000-0000-0000-000000000001',
        display_name: 'Alex Guest',
        guest_contact_points: [{ contact_type: 'email', value: 'alex@example.com', normalized_value: 'alex@example.com', value_hash: hash, is_verified: true }],
      }),
      guest({
        id: '00000000-0000-0000-0000-000000000002',
        display_name: 'A Guest',
        guest_contact_points: [{ contact_type: 'email', value: 'alex@example.com', normalized_value: 'alex@example.com', value_hash: hash, is_verified: true }],
      }),
    ])

    expect(candidates[0]?.confidence).toBe(100)
    expect(candidates[0]?.signals).toContain('verified_email')
  })

  it('treats name-only matches as below the suggestion threshold', () => {
    const candidates = buildIdentityCandidates([
      guest({ id: '00000000-0000-0000-0000-000000000001', display_name: 'Jordan Smith' }),
      guest({ id: '00000000-0000-0000-0000-000000000002', display_name: 'Jordan Smith' }),
    ])

    expect(candidates).toHaveLength(0)
  })

  it('marks name plus contact hints as weak suggestion-only evidence', () => {
    const candidates = buildIdentityCandidates([
      guest({
        id: '00000000-0000-0000-0000-000000000001',
        display_name: 'Taylor Stone',
        guest_contact_points: [{ contact_type: 'phone', value: '555-111-1234', normalized_value: '+15551111234', value_hash: hashGuestContactValue('+15551111234'), is_verified: false }],
      }),
      guest({
        id: '00000000-0000-0000-0000-000000000002',
        display_name: 'Taylor Stone',
        guest_contact_points: [{ contact_type: 'phone', value: '555-999-1234', normalized_value: '+15559991234', value_hash: hashGuestContactValue('+15559991234'), is_verified: false }],
      }),
    ])

    expect(candidates[0]?.confidence).toBe(50)
    expect(candidates[0]?.confidence_level).toBe('50')
    expect(candidates[0]?.signals).toContain('name_phone_hint')
  })
})
