import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { classifyCrmFeedback, crmComplaintSummary, crmFeedbackManageRoles, crmFeedbackReadRoles } from '@/lib/crm/feedback'
import { createRecoveryCaseFromComplaint } from '@/lib/crm/recovery'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCrmReviewSchema, listCrmReviewsQuerySchema } from '@/lib/schemas/crm'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmFeedbackReadRoles])
  if (roleErr) return roleErr

  const parsed = listCrmReviewsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const db = createAdminClient()
  let query = db
    .from('crm_reviews')
    .select('*, guests(id, display_name), crm_complaints(id, severity, status, recovery_status)', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.provider) query = query.eq('provider', parsed.data.provider)
  if (parsed.data.sentiment) query = query.eq('sentiment', parsed.data.sentiment)
  if (parsed.data.guest_id) query = query.eq('guest_id', parsed.data.guest_id)

  const { data, error, count } = await query
  if (error) return apiError(500, 'Failed to fetch reviews')

  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmFeedbackManageRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createCrmReviewSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const db = createAdminClient()
  const { data: references, error: referenceError } = await resolveReviewReferences({
    db,
    orgId: user.org_id,
    guestId: parsed.data.guest_id,
    orderId: parsed.data.order_id,
    locationId: parsed.data.location_id,
  })
  if (referenceError) return apiError(400, referenceError)

  const classification = classifyCrmFeedback({
    rating: parsed.data.rating,
    text: [parsed.data.title, parsed.data.body].filter(Boolean).join(' '),
    provided_sentiment: parsed.data.sentiment,
    provided_topics: parsed.data.topics,
  })

  const { data: review, error } = await db
    .from('crm_reviews')
    .upsert({
      ...parsed.data,
      org_id: user.org_id,
      location_id: references.location_id,
      guest_id: references.guest_id,
      sentiment: classification.sentiment,
      topics: classification.topics,
      imported_by_user_id: user.id,
    }, { onConflict: 'org_id,provider,external_review_id' })
    .select()
    .single()

  if (error || !review) return apiError(500, 'Failed to import review')

  let complaint = null
  let recoveryCase = null
  if (classification.sentiment === 'negative') {
    const { data: complaintRow, error: complaintError } = await db
      .from('crm_complaints')
      .insert({
        org_id: user.org_id,
        location_id: references.location_id,
        guest_id: references.guest_id,
        order_id: parsed.data.order_id ?? null,
        review_id: review.id,
        source_type: 'review',
        severity: classification.severity,
        topics: classification.topics,
        issue_summary: crmComplaintSummary({ text: parsed.data.body ?? parsed.data.title, topics: classification.topics, source: parsed.data.provider }),
        complaint_text: parsed.data.body ?? parsed.data.title ?? null,
        created_by_user_id: user.id,
        metadata: { routed_from: 'crm_reviews', provider: parsed.data.provider },
      })
      .select()
      .single()

    if (complaintError || !complaintRow) {
      return apiError(409, 'Review imported but recovery routing failed')
    }
    complaint = complaintRow
    const { caseRow, error: recoveryError } = await createRecoveryCaseFromComplaint({ db, user, complaint: complaintRow })
    if (recoveryError || !caseRow) {
      return apiError(409, 'Review imported but recovery case creation failed')
    }
    recoveryCase = caseRow
  }

  if (references.guest_id) {
    await db.from('guest_timeline_events').insert({
      org_id: user.org_id,
      location_id: references.location_id,
      guest_id: references.guest_id,
      event_type: classification.sentiment === 'negative' ? 'crm.recovery.opened' : 'crm.review.imported',
      event_source: parsed.data.provider,
      actor_user_id: user.id,
      order_id: parsed.data.order_id ?? null,
      title: classification.sentiment === 'negative' ? 'Negative public review routed to recovery' : 'Public review imported',
      body: parsed.data.body ?? parsed.data.title ?? null,
      visibility: classification.sentiment === 'negative' ? 'manager' : 'service',
      metadata: { review_id: review.id, complaint_id: complaint?.id ?? null, recovery_case_id: recoveryCase?.id ?? null, topics: classification.topics },
    })
  }

  await audit.record({
    actor: user,
    action: classification.sentiment === 'negative' ? 'crm_negative_review_routed' : 'crm_review_imported',
    entity_type: 'crm_review',
    entity_id: review.id,
    after_state: { review, complaint, recovery_case: recoveryCase } as Record<string, unknown>,
    description: classification.sentiment === 'negative' ? 'Imported negative review and routed it to recovery' : 'Imported CRM review',
    request,
    location_id: references.location_id,
  })

  return NextResponse.json({ data: { review, complaint, recovery_case: recoveryCase, recovery_required: classification.sentiment === 'negative' } }, { status: 201 })
}

async function resolveReviewReferences(input: {
  db: ReturnType<typeof createAdminClient>
  orgId: string
  guestId?: string | null
  orderId?: string | null
  locationId?: string | null
}): Promise<{ data: { guest_id: string | null; location_id: string | null }; error?: string }> {
  let guestId = input.guestId ?? null
  let locationId = input.locationId ?? null

  if (locationId) {
    const { data: location, error } = await input.db
      .from('locations')
      .select('id')
      .eq('id', locationId)
      .eq('org_id', input.orgId)
      .maybeSingle()
    if (error || !location) return { data: { guest_id: null, location_id: null }, error: 'Location not found for this organization' }
  }

  if (input.orderId) {
    const { data: order, error } = await input.db
      .from('orders')
      .select('id, location_id, metadata')
      .eq('id', input.orderId)
      .eq('org_id', input.orgId)
      .maybeSingle()
    if (error || !order) return { data: { guest_id: null, location_id: null }, error: 'Order not found for this organization' }
    locationId = (order as { location_id: string | null }).location_id ?? locationId
    const metadataGuestId = ((order as { metadata?: Record<string, unknown> | null }).metadata ?? {}).crm_guest_id
    if (!guestId && typeof metadataGuestId === 'string') guestId = metadataGuestId
  }

  if (guestId) {
    const { data: guest, error } = await input.db
      .from('guests')
      .select('id, location_id')
      .eq('id', guestId)
      .eq('org_id', input.orgId)
      .maybeSingle()
    if (error || !guest) return { data: { guest_id: null, location_id: null }, error: 'Guest not found for this organization' }
    locationId = locationId ?? (guest as { location_id: string | null }).location_id
  }

  return { data: { guest_id: guestId, location_id: locationId } }
}
