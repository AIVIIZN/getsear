import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { audit } from '@/lib/audit/log'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import {
  hashGuestContactValue,
  normalizeGuestContactValue,
  type GuestContactInput,
} from '@/lib/crm/api'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_REVALIDATE_PROFILE, orderCacheTags } from '@/lib/cache/keys'

const checkoutCaptureSchema = z.object({
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().min(7).max(30).optional().nullable(),
  receipt_choice: z.enum(['print', 'email', 'text', 'none']).default('none'),
  consent: z.object({
    email_receipts: z.boolean().default(false),
    sms_receipts: z.boolean().default(false),
    marketing_email: z.boolean().default(false),
    marketing_sms: z.boolean().default(false),
    loyalty_signup: z.boolean().default(false),
  }).default({
    email_receipts: false,
    sms_receipts: false,
    marketing_email: false,
    marketing_sms: false,
    loyalty_signup: false,
  }),
  proof: z.object({
    ui_surface: z.string().trim().max(80).default('pos_receipt_prompt'),
    language_version: z.string().trim().max(80).default('crm-v2.3-checkout-capture'),
  }).default({
    ui_surface: 'pos_receipt_prompt',
    language_version: 'crm-v2.3-checkout-capture',
  }),
})

type RouteParams = { params: Promise<{ id: string }> }

type OrderCaptureRow = {
  id: string
  org_id: string
  location_id: string | null
  order_number: number | string | null
  guest_name: string | null
  guest_phone: string | null
  metadata: Record<string, unknown> | null
}

function displayNameForCapture(order: OrderCaptureRow, email: string | null, phone: string | null): string {
  const existing = order.guest_name?.trim()
  if (existing) return existing
  if (email) return email.split('@')[0]
  if (phone) return phone
  return `Order #${order.order_number ?? order.id.slice(0, 8)} Guest`
}

async function findGuestByContact(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  contacts: GuestContactInput[]
): Promise<string | null> {
  for (const contact of contacts) {
    const normalized = normalizeGuestContactValue(contact)
    const { data } = await supabase
      .from('guest_contact_points')
      .select('guest_id')
      .eq('org_id', orgId)
      .eq('contact_type', contact.contact_type)
      .eq('value_hash', hashGuestContactValue(normalized))
      .is('deleted_at', null)
      .maybeSingle()

    const row = data as { guest_id?: string } | null
    if (row?.guest_id) return row.guest_id
  }
  return null
}

async function upsertContactPoint(params: {
  supabase: ReturnType<typeof createAdminClient>
  orgId: string
  locationId: string | null
  guestId: string
  contact: GuestContactInput
  metadata: Record<string, unknown>
}) {
  const normalized = normalizeGuestContactValue(params.contact)
  const valueHash = hashGuestContactValue(normalized)
  const { data: existing } = await params.supabase
    .from('guest_contact_points')
    .select('id, guest_id, metadata')
    .eq('org_id', params.orgId)
    .eq('contact_type', params.contact.contact_type)
    .eq('value_hash', valueHash)
    .is('deleted_at', null)
    .maybeSingle()

  const existingRow = existing as { id: string; guest_id: string; metadata: Record<string, unknown> | null } | null
  if (existingRow) {
    if (existingRow.guest_id !== params.guestId) return
    await params.supabase
      .from('guest_contact_points')
      .update({
        location_id: params.locationId,
        value: params.contact.value,
        normalized_value: normalized,
        source: 'pos_checkout',
        metadata: {
          ...(existingRow.metadata ?? {}),
          checkout_capture: params.metadata,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRow.id)
    return
  }

  await params.supabase.from('guest_contact_points').insert({
    org_id: params.orgId,
    location_id: params.locationId,
    guest_id: params.guestId,
    contact_type: params.contact.contact_type,
    value: params.contact.value,
    normalized_value: normalized,
    value_hash: valueHash,
    is_primary: false,
    is_verified: false,
    source: 'pos_checkout',
    metadata: { checkout_capture: params.metadata },
  })
}

async function upsertCheckoutConsent(params: {
  supabase: ReturnType<typeof createAdminClient>
  orgId: string
  locationId: string | null
  guestId: string
  userId: string
  contactPointId: string | null
  channel: 'email' | 'sms'
  purpose: 'marketing' | 'transactional' | 'loyalty'
  granted: boolean
  source: string
  proof: Record<string, unknown>
  capturedAt: string
}) {
  const status = params.granted ? 'granted' : 'unknown'
  await params.supabase
    .from('guest_consents')
    .upsert({
      org_id: params.orgId,
      location_id: params.locationId,
      guest_id: params.guestId,
      contact_point_id: params.contactPointId,
      channel: params.channel,
      purpose: params.purpose,
      status,
      source: params.source,
      proof: params.proof,
      captured_by_user_id: params.userId,
      captured_at: params.capturedAt,
      revoked_at: null,
      metadata: {},
      updated_at: params.capturedAt,
    }, { onConflict: 'org_id,guest_id,channel,purpose' })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['platform_admin', 'owner', 'admin', 'manager', 'server', 'bartender', 'cashier'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = checkoutCaptureSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { id: orderId } = await params
  const supabase = createAdminClient()
  const { data: orderData } = await supabase
    .from('orders')
    .select('id, org_id, location_id, order_number, guest_name, guest_phone, metadata')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!orderData) {
    return apiError(404, 'Order not found')
  }

  const order = orderData as OrderCaptureRow
  const email = parsed.data.email?.trim().toLowerCase() || null
  const phone = parsed.data.phone?.trim() || null
  const contacts: GuestContactInput[] = [
    ...(email ? [{ contact_type: 'email' as const, value: email }] : []),
    ...(phone ? [{ contact_type: 'phone' as const, value: phone }] : []),
  ]
  const now = new Date().toISOString()
  const previousMetadata = order.metadata ?? {}
  let guestId = typeof previousMetadata.crm_guest_id === 'string' ? previousMetadata.crm_guest_id : null

  if (!guestId && contacts.length > 0) {
    guestId = await findGuestByContact(supabase, user.org_id, contacts)
  }

  if (!guestId && contacts.length > 0) {
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .insert({
        org_id: user.org_id,
        location_id: order.location_id,
        display_name: displayNameForCapture(order, email, phone),
        first_visit_at: now,
        last_visit_at: now,
        last_order_id: order.id,
        lifecycle_stage: 'first_time',
        metadata: { source: 'pos_checkout', first_checkout_order_id: order.id },
      })
      .select('id')
      .single()

    if (guestError || !guest) {
      return apiError(500, 'Failed to create checkout guest')
    }
    guestId = (guest as { id: string }).id
  }

  const consentProof = {
    ...parsed.data.proof,
    captured_at: now,
    captured_by_user_id: user.id,
    receipt_choice: parsed.data.receipt_choice,
    order_id: order.id,
  }
  const checkoutCapture = {
    email,
    phone,
    consent: parsed.data.consent,
    proof: consentProof,
  }

  if (guestId) {
    const { data: guestBefore } = await supabase
      .from('guests')
      .select('metadata')
      .eq('id', guestId)
      .eq('org_id', user.org_id)
      .maybeSingle()
    const guestMetadata = ((guestBefore as { metadata?: Record<string, unknown> } | null)?.metadata ?? {})

    for (const contact of contacts) {
      await upsertContactPoint({
        supabase,
        orgId: user.org_id,
        locationId: order.location_id,
        guestId,
        contact,
        metadata: checkoutCapture,
      })
    }

    const { data: contactRows } = await supabase
      .from('guest_contact_points')
      .select('id, contact_type')
      .eq('org_id', user.org_id)
      .eq('guest_id', guestId)
      .is('deleted_at', null)
      .in('contact_type', ['email', 'phone'])

    const contactPointByType = new Map((contactRows ?? []).map((row: { id: string; contact_type: string }) => [row.contact_type, row.id]))
    if (email) {
      await upsertCheckoutConsent({
        supabase,
        orgId: user.org_id,
        locationId: order.location_id,
        guestId,
        userId: user.id,
        contactPointId: contactPointByType.get('email') ?? null,
        channel: 'email',
        purpose: 'transactional',
        granted: parsed.data.consent.email_receipts,
        source: 'pos_checkout',
        proof: consentProof,
        capturedAt: now,
      })
      await upsertCheckoutConsent({
        supabase,
        orgId: user.org_id,
        locationId: order.location_id,
        guestId,
        userId: user.id,
        contactPointId: contactPointByType.get('email') ?? null,
        channel: 'email',
        purpose: 'marketing',
        granted: parsed.data.consent.marketing_email,
        source: 'pos_checkout',
        proof: consentProof,
        capturedAt: now,
      })
    }
    if (phone) {
      await upsertCheckoutConsent({
        supabase,
        orgId: user.org_id,
        locationId: order.location_id,
        guestId,
        userId: user.id,
        contactPointId: contactPointByType.get('phone') ?? null,
        channel: 'sms',
        purpose: 'transactional',
        granted: parsed.data.consent.sms_receipts,
        source: 'pos_checkout',
        proof: consentProof,
        capturedAt: now,
      })
      await upsertCheckoutConsent({
        supabase,
        orgId: user.org_id,
        locationId: order.location_id,
        guestId,
        userId: user.id,
        contactPointId: contactPointByType.get('phone') ?? null,
        channel: 'sms',
        purpose: 'marketing',
        granted: parsed.data.consent.marketing_sms,
        source: 'pos_checkout',
        proof: consentProof,
        capturedAt: now,
      })
    }

    await supabase
      .from('guests')
      .update({
        last_visit_at: now,
        last_order_id: order.id,
        metadata: {
          ...guestMetadata,
          crm_checkout_capture: checkoutCapture,
        },
        updated_at: now,
      })
      .eq('id', guestId)
      .eq('org_id', user.org_id)

    await supabase.from('guest_timeline_events').insert({
      org_id: user.org_id,
      location_id: order.location_id,
      guest_id: guestId,
      actor_user_id: user.id,
      event_type: 'crm.consent.updated',
      event_source: 'pos_checkout',
      order_id: order.id,
      title: 'Checkout contact and consent captured',
      body: 'Guest contact preferences were captured from the POS receipt prompt.',
      visibility: 'service',
      metadata: checkoutCapture,
    })
  }

  const nextMetadata = {
    ...previousMetadata,
    ...(guestId ? { crm_guest_id: guestId } : {}),
    crm_checkout_capture: checkoutCapture,
  }

  await supabase
    .from('orders')
    .update({
      guest_phone: phone ?? order.guest_phone,
      metadata: nextMetadata,
      updated_at: now,
    })
    .eq('id', order.id)
    .eq('org_id', user.org_id)

  await audit.record({
    actor: user,
    action: 'crm_guest_consent_updated',
    entity_type: guestId ? 'guest' : 'order',
    entity_id: guestId ?? order.id,
    before_state: { metadata: previousMetadata },
    after_state: { guest_id: guestId, checkout_capture: checkoutCapture },
    description: `Captured checkout CRM consent for order #${order.order_number ?? order.id.slice(0, 8)}`,
    request,
    location_id: order.location_id,
  })

  for (const tag of orderCacheTags(user.org_id, order.id)) {
    revalidateTag(tag, CACHE_REVALIDATE_PROFILE)
  }

  return NextResponse.json({
    data: {
      guest_id: guestId,
      checkout_capture: checkoutCapture,
    },
  })
}
