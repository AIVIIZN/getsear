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

  it('captures checkout contact, consent proof, and receipt CRM content', () => {
    const captureRoute = read('src/app/api/orders/[id]/checkout-capture/route.ts')
    const receiptOptions = read('src/components/payments/ReceiptOptions.tsx')
    const paymentsPage = read('src/app/(pos)/payments/page.tsx')
    const receiptRoute = read('src/app/api/integrations/email/receipt/route.ts')
    const qrRoute = read('src/app/api/loyalty/qr/route.ts')
    const emailTemplates = read('src/lib/integrations/email-templates.ts')

    expect(captureRoute).toContain('crm_checkout_capture')
    expect(captureRoute).toContain('crm.consent.updated')
    expect(captureRoute).toContain("action: 'crm_guest_consent_updated'")
    expect(captureRoute).toContain("source: 'pos_checkout'")
    expect(captureRoute).toContain('proof')
    expect(receiptOptions).toContain('Add rewards signup to receipt')
    expect(paymentsPage).toContain('/api/orders/${orderId}/checkout-capture')
    expect(paymentsPage).toContain('/api/integrations/email/receipt')
    expect(paymentsPage).toContain('/api/integrations/sms/send')
    expect(receiptRoute).toContain('loyaltySignupUrl')
    expect(qrRoute).toContain('image/svg+xml')
    expect(emailTemplates).toContain('Loyalty signup QR code')
    expect(emailTemplates).toContain('personalizedThankYou')
  })

  it('ships consent center schema, APIs, UI, and campaign send gates', () => {
    const migration = read('supabase/migrations/20260525140821_add_crm_consent_center.sql')
    const rollback = read('supabase/_rollbacks/20260525140821_add_crm_consent_center.rollback.sql')
    const consentRoute = read('src/app/api/crm/guests/[id]/consents/route.ts')
    const guestRoute = read('src/app/api/crm/guests/[id]/route.ts')
    const guestsPage = read('src/app/(backoffice)/guests/page.tsx')
    const recipients = read('src/lib/marketing/recipients.ts')
    const checkoutCapture = read('src/app/api/orders/[id]/checkout-capture/route.ts')

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.guest_consents')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.consent_policy_versions')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.suppression_entries')
    expect(migration).toContain('ALTER TABLE public.guest_consents ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('guest_consents_guest_channel_purpose_idx')
    expect(rollback).toContain('DROP TABLE IF EXISTS public.guest_consents')
    expect(consentRoute).toContain('export async function GET')
    expect(consentRoute).toContain('export async function PATCH')
    expect(consentRoute).toContain("reason: 'revoked_consent'")
    expect(consentRoute).toContain("update({ expires_at: now })")
    expect(consentRoute).toContain("action: 'crm_guest_consent_updated'")
    expect(guestRoute).toContain('guest_consents(*')
    expect(guestRoute).toContain('suppression_entries(*)')
    expect(guestsPage).toContain('Consent center')
    expect(guestsPage).toContain('Grant')
    expect(guestsPage).toContain('Revoke')
    expect(guestsPage).toContain('Suppression history')
    expect(recipients).toContain("from('guest_consents')")
    expect(recipients).toContain("from('suppression_entries')")
    expect(recipients).toContain('activeSuppressions')
    expect(recipients).toContain("status', 'granted'")
    expect(checkoutCapture).toContain('upsertCheckoutConsent')
  })
})
