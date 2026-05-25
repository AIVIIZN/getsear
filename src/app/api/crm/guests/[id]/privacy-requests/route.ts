import { NextRequest, NextResponse } from 'next/server'
import { audit } from '@/lib/audit/log'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { crmPrivacyWriteRoles } from '@/lib/crm/api'
import { createPrivacyRequestSchema, updatePrivacyRequestSchema } from '@/lib/schemas/crm'
import { createAdminClient } from '@/lib/supabase/admin'

type RouteParams = { params: Promise<{ id: string }> }

type GuestRow = {
  id: string
  org_id: string
  location_id: string | null
  display_name: string
  first_name: string | null
  last_name: string | null
  preferred_name: string | null
  birthday: string | null
  anniversary: string | null
  lifecycle_stage: string
  profile_status: string
  metadata: Record<string, unknown>
}

const terminalStatuses = new Set(['completed', 'rejected', 'cancelled'])

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmPrivacyWriteRoles])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()
  const { data: guest } = await supabase
    .from('guests')
    .select('id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('privacy_requests')
    .select('*, data_export_jobs(*), data_deletion_jobs(*), data_access_logs(*)')
    .eq('guest_id', id)
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch privacy requests' }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmPrivacyWriteRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createPrivacyRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { id } = await params
  const supabase = createAdminClient()
  const guest = await loadGuest(supabase, user.org_id, id)
  if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('privacy_requests')
    .insert({
      org_id: user.org_id,
      location_id: guest.location_id,
      guest_id: id,
      request_type: parsed.data.request_type,
      status: 'submitted',
      priority: parsed.data.priority,
      requested_by_name: parsed.data.requested_by_name,
      requested_by_contact: parsed.data.requested_by_contact,
      details: parsed.data.details ?? null,
      due_at: parsed.data.due_at ?? defaultDueAt(),
      created_by_user_id: user.id,
      metadata: parsed.data.metadata,
    })
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to create privacy request' }, { status: 500 })

  await logPrivacyAccess(supabase, {
    org_id: user.org_id,
    guest_id: id,
    privacy_request_id: data.id,
    access_type: 'request_created',
    actor_user_id: user.id,
    reason: parsed.data.details ?? null,
    metadata: { request_type: parsed.data.request_type },
  })

  await supabase.from('guest_timeline_events').insert({
    org_id: user.org_id,
    location_id: guest.location_id,
    guest_id: id,
    actor_user_id: user.id,
    event_type: 'crm.privacy.request_created',
    event_source: 'crm',
    title: 'Privacy request created',
    body: `${labelRequestType(parsed.data.request_type)} request opened for ${guest.display_name}.`,
    visibility: 'manager',
    metadata: { privacy_request_id: data.id, request_type: parsed.data.request_type },
  })

  await audit.record({
    actor: user,
    action: 'crm_privacy_request_created',
    entity_type: 'privacy_request',
    entity_id: data.id,
    after_state: data as Record<string, unknown>,
    description: `Created ${parsed.data.request_type} privacy request for ${guest.display_name}`,
    request,
    location_id: guest.location_id,
  })

  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmPrivacyWriteRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updatePrivacyRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { id } = await params
  const supabase = createAdminClient()
  const guest = await loadGuest(supabase, user.org_id, id)
  if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 })

  const { data: existing } = await supabase
    .from('privacy_requests')
    .select('*')
    .eq('id', parsed.data.request_id)
    .eq('guest_id', id)
    .eq('org_id', user.org_id)
    .maybeSingle()

  const privacyRequest = existing as (Record<string, unknown> & { id: string; request_type: string; status: string }) | null
  if (!privacyRequest) return NextResponse.json({ error: 'Privacy request not found' }, { status: 404 })
  if (terminalStatuses.has(privacyRequest.status)) return NextResponse.json({ error: 'Privacy request is already closed' }, { status: 409 })

  const now = new Date().toISOString()
  const statusPatch = await applyPrivacyAction({
    supabase,
    user,
    request,
    guest,
    privacyRequest,
    action: parsed.data.action,
    note: parsed.data.note ?? null,
    metadata: parsed.data.metadata,
    now,
  })

  if ('error' in statusPatch) return NextResponse.json({ error: statusPatch.error }, { status: statusPatch.status })

  const { data, error } = await supabase
    .from('privacy_requests')
    .update({
      ...statusPatch.patch,
      decision_note: parsed.data.note ?? (privacyRequest.decision_note as string | null | undefined) ?? null,
      metadata: { ...((privacyRequest.metadata as Record<string, unknown> | null) ?? {}), ...parsed.data.metadata },
      updated_at: now,
    })
    .eq('id', parsed.data.request_id)
    .eq('guest_id', id)
    .eq('org_id', user.org_id)
    .select('*, data_export_jobs(*), data_deletion_jobs(*), data_access_logs(*)')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to update privacy request' }, { status: 500 })

  await audit.record({
    actor: user,
    action: statusPatch.auditAction,
    entity_type: 'privacy_request',
    entity_id: parsed.data.request_id,
    before_state: privacyRequest,
    after_state: data as Record<string, unknown>,
    reason: parsed.data.note ?? null,
    description: statusPatch.description,
    request,
    location_id: guest.location_id,
  })

  return NextResponse.json({ data })
}

async function applyPrivacyAction(input: {
  supabase: ReturnType<typeof createAdminClient>
  user: { id: string; org_id: string; email: string | null; role: string }
  request: NextRequest
  guest: GuestRow
  privacyRequest: Record<string, unknown> & { id: string; request_type: string; status: string }
  action: 'approve' | 'start' | 'complete_export' | 'complete_delete' | 'complete_suppression' | 'reject' | 'cancel'
  note: string | null
  metadata: Record<string, unknown>
  now: string
}): Promise<
  | { error: string; status: number }
  | { patch: Record<string, unknown>; auditAction: 'crm_privacy_request_updated' | 'crm_privacy_data_exported' | 'crm_privacy_guest_anonymized'; description: string }
> {
  const { supabase, user, guest, privacyRequest, action, note, metadata, now } = input

  if (action === 'approve') {
    await logPrivacyAccess(supabase, { org_id: user.org_id, guest_id: guest.id, privacy_request_id: privacyRequest.id, access_type: 'request_approved', actor_user_id: user.id, reason: note, metadata })
    return {
      patch: { status: 'approved', approved_by_user_id: user.id, approved_at: now },
      auditAction: 'crm_privacy_request_updated',
      description: `Approved ${privacyRequest.request_type} privacy request for ${guest.display_name}`,
    }
  }

  if (action === 'reject' || action === 'cancel') {
    await logPrivacyAccess(supabase, { org_id: user.org_id, guest_id: guest.id, privacy_request_id: privacyRequest.id, access_type: action === 'reject' ? 'request_rejected' : 'request_cancelled', actor_user_id: user.id, reason: note, metadata })
    return {
      patch: { status: action === 'reject' ? 'rejected' : 'cancelled', completed_by_user_id: user.id, completed_at: now },
      auditAction: 'crm_privacy_request_updated',
      description: `${action === 'reject' ? 'Rejected' : 'Cancelled'} ${privacyRequest.request_type} privacy request for ${guest.display_name}`,
    }
  }

  if (privacyRequest.status !== 'approved') {
    return { error: 'Privacy request must be approved before completion', status: 409 }
  }

  if (action === 'start') {
    await logPrivacyAccess(supabase, { org_id: user.org_id, guest_id: guest.id, privacy_request_id: privacyRequest.id, access_type: 'request_started', actor_user_id: user.id, reason: note, metadata })
    return {
      patch: { status: 'in_progress' },
      auditAction: 'crm_privacy_request_updated',
      description: `Started ${privacyRequest.request_type} privacy request for ${guest.display_name}`,
    }
  }

  if (action === 'complete_export') {
    if (privacyRequest.request_type !== 'export') return { error: 'Only export requests can generate exports', status: 409 }
    const exportPayload = await buildGuestExport(supabase, user.org_id, guest.id)
    await supabase.from('data_export_jobs').insert({
      org_id: user.org_id,
      privacy_request_id: privacyRequest.id,
      guest_id: guest.id,
      status: 'completed',
      export_payload: exportPayload,
      generated_by_user_id: user.id,
      generated_at: now,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      metadata,
    })
    await logPrivacyAccess(supabase, { org_id: user.org_id, guest_id: guest.id, privacy_request_id: privacyRequest.id, access_type: 'export_generated', actor_user_id: user.id, reason: note, metadata: { ...metadata, sections: Object.keys(exportPayload) } })
    await insertPrivacyTimeline(supabase, user.id, guest, privacyRequest.id, 'Privacy export generated', 'Guest CRM data export generated for approved privacy request.')
    return {
      patch: { status: 'completed', completed_by_user_id: user.id, completed_at: now },
      auditAction: 'crm_privacy_data_exported',
      description: `Generated privacy export for ${guest.display_name}`,
    }
  }

  if (action === 'complete_delete') {
    if (privacyRequest.request_type !== 'delete') return { error: 'Only delete requests can anonymize guests', status: 409 }
    const report = await anonymizeGuestForPrivacyRequest(supabase, user.org_id, guest, privacyRequest.id, user.id, now)
    await supabase.from('data_deletion_jobs').insert({
      org_id: user.org_id,
      privacy_request_id: privacyRequest.id,
      guest_id: guest.id,
      status: 'completed',
      anonymization_report: report,
      completed_by_user_id: user.id,
      completed_at: now,
      metadata,
    })
    await logPrivacyAccess(supabase, { org_id: user.org_id, guest_id: guest.id, privacy_request_id: privacyRequest.id, access_type: 'guest_anonymized', actor_user_id: user.id, reason: note, metadata: report })
    await insertPrivacyTimeline(supabase, user.id, guest, privacyRequest.id, 'Guest anonymized', 'Marketing reachability removed while order and payment records remain intact.')
    return {
      patch: { status: 'completed', completed_by_user_id: user.id, completed_at: now },
      auditAction: 'crm_privacy_guest_anonymized',
      description: `Anonymized CRM guest ${guest.id} for privacy request`,
    }
  }

  await applyPrivacySuppression(supabase, user.org_id, guest.id, privacyRequest.id, user.id, now, privacyRequest.request_type)
  await logPrivacyAccess(supabase, { org_id: user.org_id, guest_id: guest.id, privacy_request_id: privacyRequest.id, access_type: 'suppression_applied', actor_user_id: user.id, reason: note, metadata })
  return {
    patch: { status: 'completed', completed_by_user_id: user.id, completed_at: now },
    auditAction: 'crm_privacy_request_updated',
    description: `Completed ${privacyRequest.request_type} privacy request for ${guest.display_name}`,
  }
}

async function loadGuest(supabase: ReturnType<typeof createAdminClient>, orgId: string, guestId: string): Promise<GuestRow | null> {
  const { data } = await supabase
    .from('guests')
    .select('id, org_id, location_id, display_name, first_name, last_name, preferred_name, birthday, anniversary, lifecycle_stage, profile_status, metadata')
    .eq('id', guestId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return data as GuestRow | null
}

async function buildGuestExport(supabase: ReturnType<typeof createAdminClient>, orgId: string, guestId: string) {
  const [guest, contactPoints, consents, suppressions, notes, preferences, allergies, tags, timeline, orders] = await Promise.all([
    supabase.from('guests').select('*').eq('id', guestId).eq('org_id', orgId).single(),
    supabase.from('guest_contact_points').select('*').eq('guest_id', guestId).eq('org_id', orgId).is('deleted_at', null),
    supabase.from('guest_consents').select('*').eq('guest_id', guestId).eq('org_id', orgId),
    supabase.from('suppression_entries').select('*').eq('guest_id', guestId).eq('org_id', orgId),
    supabase.from('guest_notes').select('*').eq('guest_id', guestId).eq('org_id', orgId).is('deleted_at', null),
    supabase.from('guest_preferences').select('*').eq('guest_id', guestId).eq('org_id', orgId).is('deleted_at', null),
    supabase.from('guest_allergies').select('*').eq('guest_id', guestId).eq('org_id', orgId).is('deleted_at', null),
    supabase.from('guest_tags').select('*, crm_tags(name, slug, tag_category)').eq('guest_id', guestId).eq('org_id', orgId).is('deleted_at', null),
    supabase.from('guest_timeline_events').select('*').eq('guest_id', guestId).eq('org_id', orgId).order('event_at', { ascending: false }).limit(250),
    supabase.from('orders').select('id, order_number, order_type, status, subtotal, tax, total, tip_amount, created_at, closed_at, metadata').eq('org_id', orgId).contains('metadata', { crm_guest_id: guestId }).limit(250),
  ])

  return {
    generated_at: new Date().toISOString(),
    guest: guest.data,
    contact_points: contactPoints.data ?? [],
    consents: consents.data ?? [],
    suppressions: suppressions.data ?? [],
    notes: notes.data ?? [],
    preferences: preferences.data ?? [],
    allergies: allergies.data ?? [],
    tags: tags.data ?? [],
    timeline: timeline.data ?? [],
    financial_records: {
      orders: orders.data ?? [],
      integrity_note: 'Order, payment, tax, and accounting records are preserved; CRM identifiers are exported for guest review only.',
    },
  }
}

async function anonymizeGuestForPrivacyRequest(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  guest: GuestRow,
  privacyRequestId: string,
  actorUserId: string,
  now: string
) {
  const { data: contactPoints } = await supabase
    .from('guest_contact_points')
    .select('id, contact_type, value_hash')
    .eq('guest_id', guest.id)
    .eq('org_id', orgId)
    .is('deleted_at', null)

  await supabase
    .from('guests')
    .update({
      display_name: `Privacy Request ${guest.id.slice(0, 8)}`,
      first_name: null,
      last_name: null,
      preferred_name: null,
      birthday: null,
      anniversary: null,
      lifecycle_stage: 'do_not_contact',
      profile_status: 'archived',
      is_vip: false,
      metadata: {
        ...guest.metadata,
        privacy_anonymized_at: now,
        privacy_request_id: privacyRequestId,
        accounting_integrity: 'orders_payments_taxes_preserved',
      },
      updated_at: now,
    })
    .eq('id', guest.id)
    .eq('org_id', orgId)

  for (const table of ['guest_contact_points', 'guest_identifiers', 'guest_preferences', 'guest_allergies', 'guest_notes']) {
    await supabase
      .from(table)
      .update({ deleted_at: now, updated_at: now })
      .eq('guest_id', guest.id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
  }

  await supabase
    .from('guest_tags')
    .update({ deleted_at: now })
    .eq('guest_id', guest.id)
    .eq('org_id', orgId)
    .is('deleted_at', null)

  const suppressionRows = (contactPoints ?? [])
    .filter((point: { contact_type: string; value_hash?: string | null }) => ['email', 'phone'].includes(point.contact_type) && point.value_hash)
    .flatMap((point: { contact_type: string; value_hash: string }) => {
      const channels = point.contact_type === 'email' ? ['email'] : ['sms', 'phone']
      return channels.map((channel) => ({
        org_id: orgId,
        guest_id: guest.id,
        channel,
        purpose: 'all',
        suppressed_value_hash: point.value_hash,
        reason: 'privacy_request',
        source: 'crm_privacy_request',
        proof: { privacy_request_id: privacyRequestId, action: 'delete_anonymize' },
        suppressed_by_user_id: actorUserId,
        suppressed_at: now,
      }))
    })

  if (suppressionRows.length > 0) await supabase.from('suppression_entries').insert(suppressionRows)
  return {
    guest_id: guest.id,
    anonymized_fields: ['display_name', 'first_name', 'last_name', 'preferred_name', 'birthday', 'anniversary', 'metadata'],
    soft_deleted_tables: ['guest_contact_points', 'guest_identifiers', 'guest_preferences', 'guest_allergies', 'guest_notes', 'guest_tags'],
    suppression_entries_created: suppressionRows.length,
    preserved_records: ['orders', 'payments', 'taxes', 'audit_log', 'guest_timeline_events'],
  }
}

async function applyPrivacySuppression(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  guestId: string,
  privacyRequestId: string,
  actorUserId: string,
  now: string,
  requestType: string
) {
  const channels = requestType === 'do_not_contact' ? ['email', 'sms', 'phone', 'mail'] : ['email', 'sms']
  await supabase.from('suppression_entries').insert(channels.map((channel) => ({
    org_id: orgId,
    guest_id: guestId,
    channel,
    purpose: requestType === 'limit_sensitive_use' ? 'personalization' : 'all',
    reason: 'privacy_request',
    source: 'crm_privacy_request',
    proof: { privacy_request_id: privacyRequestId, request_type: requestType },
    suppressed_by_user_id: actorUserId,
    suppressed_at: now,
  })))
}

async function logPrivacyAccess(
  supabase: ReturnType<typeof createAdminClient>,
  row: {
    org_id: string
    guest_id: string
    privacy_request_id: string
    access_type: string
    actor_user_id: string
    reason?: string | null
    metadata?: Record<string, unknown>
  }
) {
  await supabase.from('data_access_logs').insert(row)
}

async function insertPrivacyTimeline(
  supabase: ReturnType<typeof createAdminClient>,
  actorUserId: string,
  guest: GuestRow,
  privacyRequestId: string,
  title: string,
  body: string
) {
  await supabase.from('guest_timeline_events').insert({
    org_id: guest.org_id,
    location_id: guest.location_id,
    guest_id: guest.id,
    actor_user_id: actorUserId,
    event_type: 'crm.privacy.updated',
    event_source: 'crm',
    title,
    body,
    visibility: 'manager',
    metadata: { privacy_request_id: privacyRequestId },
  })
}

function defaultDueAt() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
}

function labelRequestType(type: string) {
  return type.replaceAll('_', ' ')
}
