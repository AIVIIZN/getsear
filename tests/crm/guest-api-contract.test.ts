import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  canReadGuestNote,
  canReadGuestVisibility,
  escapePostgrestLikePattern,
  getCrmGuestPermissions,
  hashGuestContactValue,
  normalizeGuestContactValue,
  noteVisibilityFilter,
  sanitizeGuestOrderForCrmRole,
  sanitizeGuestForCrmRole,
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
    expect(canReadGuestNote({ role: 'server' }, { note_category: 'hospitality', visibility: 'service' })).toBe(true)
    expect(canReadGuestNote({ role: 'server' }, { note_category: 'service_recovery', visibility: 'service' })).toBe(false)
    expect(canReadGuestNote({ role: 'manager' }, { note_category: 'service_recovery', visibility: 'manager' })).toBe(true)
    expect(getCrmGuestPermissions({ role: 'admin' }).can_export_guest_data).toBe(true)
    expect(getCrmGuestPermissions({ role: 'analyst' }).can_view_revenue_attribution).toBe(true)
  })

  it('redacts CRM field-level data for staff roles', () => {
    const guest = sanitizeGuestForCrmRole({
      id: 'guest-1',
      lifecycle_stage: 'do_not_contact',
      total_spend: 1250,
      average_check: 42,
      last_order_id: 'order-1',
      metadata: { do_not_contact_reason: 'legal request' },
      suppression_entries: [{ id: 'suppression-1', reason: 'privacy_request', proof: { source_ip: '127.0.0.1' } }],
      notes: [
        { id: 'note-1', note_category: 'hospitality', visibility: 'service', body: 'Likes booth 4' },
        { id: 'note-2', note_category: 'service_recovery', visibility: 'service', body: 'Complaint detail' },
        { id: 'note-3', note_category: 'sensitive', visibility: 'manager', body: 'Internal note' },
      ],
    }, { role: 'server' })

    expect(guest.total_spend).toBeNull()
    expect(guest.average_check).toBeNull()
    expect(guest.last_order_id).toBeNull()
    expect(guest.metadata).toEqual({})
    expect(guest.suppression_entries).toEqual([])
    expect(guest.notes).toHaveLength(1)
    expect(guest.notes[0].note_category).toBe('hospitality')
    expect(guest.crm_permissions.can_view_revenue_attribution).toBe(false)
    expect(sanitizeGuestOrderForCrmRole({ id: 'order-1', subtotal: 100, tax_total: 8, total: 108 }, { role: 'server' })).toEqual({
      id: 'order-1',
      subtotal: null,
      tax_total: null,
      total: null,
    })
  })

  it('keeps recovery and revenue fields for permitted CRM roles', () => {
    const managerGuest = sanitizeGuestForCrmRole({
      id: 'guest-1',
      total_spend: 1250,
      notes: [
        { id: 'note-1', note_category: 'hospitality', visibility: 'service', body: 'Likes booth 4' },
        { id: 'note-2', note_category: 'service_recovery', visibility: 'manager', body: 'Complaint detail' },
      ],
    }, { role: 'manager' })
    const ownerGuest = sanitizeGuestForCrmRole({ id: 'guest-2', total_spend: 1250, average_check: 42 }, { role: 'owner' })

    expect(managerGuest.notes).toHaveLength(2)
    expect(managerGuest.total_spend).toBeNull()
    expect(ownerGuest.total_spend).toBe(1250)
    expect(ownerGuest.crm_permissions.can_export_guest_data).toBe(true)
  })

  it('ships the required CRM-native guest routes', () => {
    const guestsRoute = read('src/app/api/crm/guests/route.ts')
    const guestRoute = read('src/app/api/crm/guests/[id]/route.ts')
    const guestOrdersRoute = read('src/app/api/crm/guests/[id]/orders/route.ts')
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
    expect(guestsRoute).toContain("sort_by === 'total_spend'")
    expect(guestOrdersRoute).toContain('sanitizeGuestOrderForCrmRole')
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
    const authMeRoute = read('src/app/api/auth/me/route.ts')
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
    expect(guestRoute).toContain('sanitizeGuestForCrmRole')
    expect(authMeRoute).toContain('crm_permissions: getCrmGuestPermissions(profile)')
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

  it('ships privacy rights schema, workflow API, UI tracking, and anonymization guardrails', () => {
    const migration = read('supabase/migrations/20260525143744_add_crm_privacy_rights.sql')
    const rollback = read('supabase/_rollbacks/20260525143744_add_crm_privacy_rights.rollback.sql')
    const privacyRoute = read('src/app/api/crm/guests/[id]/privacy-requests/route.ts')
    const guestRoute = read('src/app/api/crm/guests/[id]/route.ts')
    const guestsPage = read('src/app/(backoffice)/guests/page.tsx')
    const auditLog = read('src/lib/audit/log.ts')

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.privacy_requests')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.data_export_jobs')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.data_deletion_jobs')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.data_access_logs')
    expect(migration).toContain('ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY')
    expect(rollback).toContain('DROP TABLE IF EXISTS public.privacy_requests')
    expect(privacyRoute).toContain('export async function GET')
    expect(privacyRoute).toContain('export async function POST')
    expect(privacyRoute).toContain('export async function PATCH')
    expect(privacyRoute).toContain('buildGuestExport')
    expect(privacyRoute).toContain('anonymizeGuestForPrivacyRequest')
    expect(privacyRoute).toContain('orders_payments_taxes_preserved')
    expect(privacyRoute).toContain("reason: 'privacy_request'")
    expect(privacyRoute).toContain("auditAction: 'crm_privacy_data_exported'")
    expect(privacyRoute).toContain("auditAction: 'crm_privacy_guest_anonymized'")
    expect(auditLog).toContain("'crm_privacy_request_created'")
    expect(guestRoute).not.toContain('privacy_requests(*')
    expect(guestsPage).toContain('Privacy rights')
    expect(guestsPage).toContain('Generate export')
    expect(guestsPage).toContain('Anonymize')
  })

  it('ships CRM-native loyalty routes with ledger, POS earn, redemption, and audit contracts', () => {
    const programsRoute = read('src/app/api/crm/loyalty/programs/route.ts')
    const accountsRoute = read('src/app/api/crm/loyalty/accounts/route.ts')
    const earnRoute = read('src/app/api/crm/loyalty/accounts/[id]/earn/route.ts')
    const redeemRoute = read('src/app/api/crm/loyalty/accounts/[id]/redeem/route.ts')
    const ledgerRoute = read('src/app/api/crm/loyalty/accounts/[id]/ledger/route.ts')
    const rewardsRoute = read('src/app/api/crm/loyalty/rewards/route.ts')
    const redemptionsRoute = read('src/app/api/crm/loyalty/redemptions/route.ts')
    const loyaltyHelper = read('src/lib/crm/loyalty.ts')
    const auditLog = read('src/lib/audit/log.ts')

    expect(programsRoute).toContain('export async function GET')
    expect(programsRoute).toContain('export async function POST')
    expect(programsRoute).toContain("from('crm_loyalty_programs')")
    expect(programsRoute).toContain("from('crm_loyalty_rules')")
    expect(programsRoute).toContain("from('crm_loyalty_tiers')")
    expect(accountsRoute).toContain('export async function GET')
    expect(accountsRoute).toContain('export async function POST')
    expect(accountsRoute).toContain('assertCrmGuest')
    expect(accountsRoute).toContain('assertProgram')
    expect(earnRoute).toContain('earnPoints')
    expect(redeemRoute).toContain('redeemReward')
    expect(ledgerRoute).toContain("from('crm_points_ledger')")
    expect(ledgerRoute).toContain('explanation')
    expect(rewardsRoute).toContain("from('crm_rewards')")
    expect(redemptionsRoute).toContain("from('crm_reward_redemptions')")
    expect(loyaltyHelper).toContain("status !== 'closed'")
    expect(loyaltyHelper).toContain("source: input.order_id ? 'pos_closed_check' : 'crm'")
    expect(loyaltyHelper).toContain("source: input.orderId ? 'pos_checkout' : 'crm'")
    expect(loyaltyHelper).toContain("action: 'crm_loyalty_points_earned'")
    expect(loyaltyHelper).toContain("action: 'crm_loyalty_reward_redeemed'")
    expect(auditLog).toContain("'crm_loyalty_program_created'")
    expect(auditLog).toContain("'crm_loyalty_account_enrolled'")
    expect(auditLog).toContain("'crm_loyalty_reward_created'")
  })
})
