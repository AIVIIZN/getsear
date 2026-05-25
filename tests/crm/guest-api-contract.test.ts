import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  canReadGuestVisibility,
  escapePostgrestLikePattern,
  hashGuestContactValue,
  normalizeGuestContactValue,
  noteVisibilityFilter,
} from '@/lib/crm/api'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V1.2 guest API contract', () => {
  it('normalizes and hashes contact points for duplicate-safe guest search', () => {
    expect(normalizeGuestContactValue({ contact_type: 'email', value: ' Avery@Example.COM ' })).toBe('avery@example.com')
    expect(normalizeGuestContactValue({ contact_type: 'phone', value: '(512) 555-0199' })).toBe('+15125550199')
    expect(hashGuestContactValue('avery@example.com')).toMatch(/^[a-f0-9]{64}$/)
    expect(escapePostgrestLikePattern(String.raw`Avery\\_%`)).toBe('Avery\\\\\\\\\\_\\%')
  })

  it('gates sensitive note visibility by role', () => {
    expect(noteVisibilityFilter({ role: 'server' })).toBe('visibility.eq.service')
    expect(noteVisibilityFilter({ role: 'manager' })).toBe('visibility.in.(service,manager)')
    expect(noteVisibilityFilter({ role: 'owner' })).toBe('visibility.in.(service,manager,owner)')
    expect(canReadGuestVisibility({ role: 'server' }, 'owner')).toBe(false)
    expect(canReadGuestVisibility({ role: 'manager' }, 'manager')).toBe(true)
  })

  it('ships the required CRM-native guest routes', () => {
    const guestsRoute = read('src/app/api/crm/guests/route.ts')
    const guestRoute = read('src/app/api/crm/guests/[id]/route.ts')
    const timelineRoute = read('src/app/api/crm/guests/[id]/timeline/route.ts')
    const notesRoute = read('src/app/api/crm/guests/[id]/notes/route.ts')
    const tagsRoute = read('src/app/api/crm/guests/[id]/tags/route.ts')

    expect(guestsRoute).toContain('export async function GET')
    expect(guestsRoute).toContain('export async function POST')
    expect(guestsRoute).toContain('preferenceGuestIds')
    expect(guestsRoute).toContain("query.eq('birthday', birthday)")
    expect(guestsRoute).not.toContain('query.or(`${nameFilter}')
    expect(guestRoute).toContain('export async function GET')
    expect(guestRoute).toContain('export async function PATCH')
    expect(guestRoute).toContain('normalizeGuestContactValue(contact)')
    expect(guestRoute).toContain("from('guest_contact_points')")
    expect(timelineRoute).toContain("from('guest_timeline_events')")
    expect(notesRoute).toContain('Sensitive notes must be manager or owner visible')
    expect(tagsRoute).toContain("from('guest_tags')")
  })

  it('emits timeline and audit records for guest mutations', () => {
    const routeFiles = [
      read('src/app/api/crm/guests/route.ts'),
      read('src/app/api/crm/guests/[id]/route.ts'),
      read('src/app/api/crm/guests/[id]/notes/route.ts'),
      read('src/app/api/crm/guests/[id]/tags/route.ts'),
    ].join('\n')

    expect(routeFiles).toContain('crm.guest.created')
    expect(routeFiles).toContain('crm.guest.updated')
    expect(routeFiles).toContain('crm.guest.note_added')
    expect(routeFiles).toContain('crm.guest.tagged')
    expect(routeFiles).toContain("action: 'crm_guest_created'")
    expect(routeFiles).toContain("action: 'crm_guest_updated'")
    expect(routeFiles).toContain("action: 'crm_guest_note_added'")
    expect(routeFiles).toContain("action: 'crm_guest_tagged'")
  })

  it('ships POS guest lookup and order attachment contracts', () => {
    const lookupRoute = read('src/app/api/crm/guests/lookup/route.ts')
    const attachRoute = read('src/app/api/orders/[id]/guest/route.ts')
    const guestOrdersRoute = read('src/app/api/crm/guests/[id]/orders/route.ts')
    const orderPanel = read('src/components/pos/OrderPanel.tsx')
    const guestCard = read('src/components/pos/GuestAttachmentCard.tsx')
    const orderStore = read('src/stores/order-store.ts')

    expect(lookupRoute).toContain("hashGuestContactValue")
    expect(lookupRoute).toContain("normalizeGuestContactValue")
    expect(lookupRoute).toContain("guest_allergies")
    expect(attachRoute).toContain("crm_guest_id")
    expect(attachRoute).toContain("crm.guest.attached_to_order")
    expect(attachRoute).toContain("action: 'crm_guest_attached_to_order'")
    expect(attachRoute).toContain('export async function DELETE')
    expect(attachRoute).toContain("crm.guest.detached_from_order")
    expect(guestOrdersRoute).toContain("contains('metadata', { crm_guest_id: id })")
    expect(orderPanel).toContain('GuestAttachmentCard')
    expect(orderPanel).toContain('/api/orders/${currentOrder.id}/guest')
    expect(guestCard).toContain('/api/crm/guests/lookup')
    expect(guestCard).toContain('/api/loyalty/enroll')
    expect(orderStore).toContain('attachGuest: (guest: OrderGuestMemory | null) => void')
  })
})
