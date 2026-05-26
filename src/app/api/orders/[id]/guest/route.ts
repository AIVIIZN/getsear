import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestWriteRoles } from '@/lib/crm/api'
import { CACHE_REVALIDATE_PROFILE, orderCacheTags } from '@/lib/cache/keys'

const attachGuestSchema = z.object({
  guest_id: z.string().uuid(),
})

type RouteParams = { params: Promise<{ id: string }> }

type GuestAttachRow = {
  id: string
  display_name: string
  location_id: string | null
  guest_contact_points?: { contact_type: string; value: string; normalized_value: string | null; is_primary: boolean }[]
  guest_allergies?: { allergen: string; severity: string; is_active: boolean }[]
}

function primaryContact(row: GuestAttachRow, type: 'phone' | 'email'): string | null {
  const contacts = row.guest_contact_points ?? []
  return contacts.find((contact) => contact.contact_type === type && contact.is_primary)?.value
    ?? contacts.find((contact) => contact.contact_type === type)?.value
    ?? null
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestWriteRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = attachGuestSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { id: orderId } = await params
  const supabase = createAdminClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, org_id, location_id, order_number, metadata, guest_name, guest_phone')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return apiError(404, 'Order not found')
  }

  const { data: guest, error: guestError } = await supabase
    .from('guests')
    .select('id, display_name, location_id, guest_contact_points(contact_type, value, normalized_value, is_primary), guest_allergies(allergen, severity, is_active)')
    .eq('id', parsed.data.guest_id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (guestError || !guest) {
    return apiError(404, 'Guest not found')
  }

  const guestRow = guest as GuestAttachRow
  const phone = primaryContact(guestRow, 'phone')
  const metadata = {
    ...((order.metadata as Record<string, unknown> | null) ?? {}),
    crm_guest_id: guestRow.id,
    crm_guest_display_name: guestRow.display_name,
    crm_guest_attached_at: new Date().toISOString(),
    crm_guest_allergens: (guestRow.guest_allergies ?? [])
      .filter((allergy) => allergy.is_active)
      .map(({ allergen, severity }) => ({ allergen, severity })),
  }

  const { data: updatedOrder, error: updateError } = await supabase
    .from('orders')
    .update({
      guest_name: guestRow.display_name,
      guest_phone: phone,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (updateError || !updatedOrder) {
    return apiError(500, 'Failed to attach guest to order')
  }

  await supabase.from('guest_timeline_events').insert({
    org_id: user.org_id,
    location_id: order.location_id ?? guestRow.location_id ?? null,
    guest_id: guestRow.id,
    actor_user_id: user.id,
    event_type: 'crm.guest.attached_to_order',
    event_source: 'pos',
    order_id: orderId,
    title: 'Attached to POS order',
    body: `Attached to order #${order.order_number}.`,
    visibility: 'service',
    metadata: { order_id: orderId, order_number: order.order_number },
  })

  await audit.record({
    actor: user,
    action: 'crm_guest_attached_to_order',
    entity_type: 'order',
    entity_id: orderId,
    before_state: {
      guest_name: order.guest_name,
      guest_phone: order.guest_phone,
      metadata: order.metadata,
    },
    after_state: {
      guest_id: guestRow.id,
      guest_name: guestRow.display_name,
      guest_phone: phone,
    },
    description: `Attached CRM guest ${guestRow.display_name} to order #${order.order_number}`,
    request,
    location_id: order.location_id ?? null,
  })

  for (const tag of orderCacheTags(user.org_id, orderId)) {
    revalidateTag(tag, CACHE_REVALIDATE_PROFILE)
  }

  return NextResponse.json({ data: updatedOrder })
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestWriteRoles])
  if (roleErr) return roleErr

  const { id: orderId } = await params
  const supabase = createAdminClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, org_id, location_id, order_number, metadata, guest_name, guest_phone')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return apiError(404, 'Order not found')
  }

  const previousMetadata = (order.metadata as Record<string, unknown> | null) ?? {}
  const previousGuestId = typeof previousMetadata.crm_guest_id === 'string'
    ? previousMetadata.crm_guest_id
    : null
  const metadata = { ...previousMetadata }
  delete metadata.crm_guest_id
  delete metadata.crm_guest_display_name
  delete metadata.crm_guest_attached_at
  delete metadata.crm_guest_allergens

  const { data: updatedOrder, error: updateError } = await supabase
    .from('orders')
    .update({
      guest_name: null,
      guest_phone: null,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (updateError || !updatedOrder) {
    return apiError(500, 'Failed to detach guest from order')
  }

  if (previousGuestId) {
    await supabase.from('guest_timeline_events').insert({
      org_id: user.org_id,
      location_id: order.location_id ?? null,
      guest_id: previousGuestId,
      actor_user_id: user.id,
      event_type: 'crm.guest.detached_from_order',
      event_source: 'pos',
      order_id: orderId,
      title: 'Detached from POS order',
      body: `Detached from order #${order.order_number}.`,
      visibility: 'service',
      metadata: { order_id: orderId, order_number: order.order_number },
    })
  }

  await audit.record({
    actor: user,
    action: 'crm_guest_detached_from_order',
    entity_type: 'order',
    entity_id: orderId,
    before_state: {
      guest_name: order.guest_name,
      guest_phone: order.guest_phone,
      metadata: order.metadata,
    },
    after_state: {
      guest_name: null,
      guest_phone: null,
      metadata,
    },
    description: `Detached CRM guest from order #${order.order_number}`,
    request,
    location_id: order.location_id ?? null,
  })

  return NextResponse.json({ data: updatedOrder })
}
