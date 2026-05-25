import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { classifyCrmFeedback, crmComplaintSummary, crmFeedbackReadRoles, crmFeedbackManageRoles } from '@/lib/crm/feedback'
import { createRecoveryCaseFromComplaint } from '@/lib/crm/recovery'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCrmSurveyResponseSchema, listCrmFeedbackQuerySchema } from '@/lib/schemas/crm'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmFeedbackReadRoles])
  if (roleErr) return roleErr

  const parsed = listCrmFeedbackQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const db = createAdminClient()
  let query = db
    .from('crm_survey_responses')
    .select('*, guests(id, display_name), crm_surveys(id, name), crm_complaints(id, severity, status, recovery_status)', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('submitted_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.sentiment) query = query.eq('sentiment', parsed.data.sentiment)
  if (parsed.data.guest_id) query = query.eq('guest_id', parsed.data.guest_id)
  if (parsed.data.order_id) query = query.eq('order_id', parsed.data.order_id)
  if (parsed.data.source_type) query = query.eq('source_type', parsed.data.source_type)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })

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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createCrmSurveyResponseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: references, error: referenceError } = await resolveFeedbackReferences({
    db,
    orgId: user.org_id,
    surveyId: parsed.data.survey_id,
    guestId: parsed.data.guest_id,
    orderId: parsed.data.order_id,
    staffUserId: parsed.data.staff_user_id,
    locationId: parsed.data.location_id,
  })
  if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 })

  const classification = classifyCrmFeedback({
    rating: parsed.data.rating,
    nps_score: parsed.data.nps_score,
    text: parsed.data.response_text,
    provided_sentiment: parsed.data.sentiment,
    provided_topics: parsed.data.topics,
  })
  const locationId = references.location_id ?? parsed.data.location_id ?? null

  const { data: response, error } = await db
    .from('crm_survey_responses')
    .insert({
      ...parsed.data,
      org_id: user.org_id,
      location_id: locationId,
      survey_id: parsed.data.survey_id ?? null,
      guest_id: references.guest_id,
      staff_user_id: references.staff_user_id,
      sentiment: classification.sentiment,
      topics: classification.topics,
      submitted_by_user_id: user.id,
    })
    .select()
    .single()

  if (error || !response) return NextResponse.json({ error: 'Failed to create feedback response' }, { status: 500 })

  let complaint = null
  let recoveryCase = null
  if (classification.sentiment === 'negative') {
    const { data: complaintRow, error: complaintError } = await db
      .from('crm_complaints')
      .insert({
        org_id: user.org_id,
        location_id: locationId,
        guest_id: references.guest_id,
        order_id: parsed.data.order_id ?? null,
        staff_user_id: references.staff_user_id,
        survey_response_id: response.id,
        source_type: complaintSourceType(parsed.data.source_type),
        severity: classification.severity,
        topics: classification.topics,
        issue_summary: crmComplaintSummary({ text: parsed.data.response_text, topics: classification.topics, source: parsed.data.source_type }),
        complaint_text: parsed.data.response_text ?? null,
        created_by_user_id: user.id,
        metadata: { routed_from: 'crm_survey_responses' },
      })
      .select()
      .single()

    if (complaintError || !complaintRow) {
      return NextResponse.json({ error: 'Feedback saved but recovery routing failed' }, { status: 409 })
    }
    complaint = complaintRow
    const { caseRow, error: recoveryError } = await createRecoveryCaseFromComplaint({ db, user, complaint: complaintRow })
    if (recoveryError || !caseRow) {
      return NextResponse.json({ error: 'Feedback saved but recovery case creation failed' }, { status: 409 })
    }
    recoveryCase = caseRow
  }

  if (references.guest_id) {
    await db.from('guest_timeline_events').insert({
      org_id: user.org_id,
      location_id: locationId,
      guest_id: references.guest_id,
      event_type: classification.sentiment === 'negative' ? 'crm.recovery.opened' : 'crm.feedback.received',
      event_source: parsed.data.source_type,
      actor_user_id: user.id,
      order_id: parsed.data.order_id ?? null,
      title: classification.sentiment === 'negative' ? 'Negative feedback routed to recovery' : 'Guest feedback received',
      body: parsed.data.response_text ?? null,
      visibility: classification.sentiment === 'negative' ? 'manager' : 'service',
      metadata: { response_id: response.id, complaint_id: complaint?.id ?? null, recovery_case_id: recoveryCase?.id ?? null, topics: classification.topics },
    })
  }

  await audit.record({
    actor: user,
    action: classification.sentiment === 'negative' ? 'crm_negative_feedback_routed' : 'crm_feedback_created',
    entity_type: 'crm_survey_response',
    entity_id: response.id,
    after_state: { response, complaint, recovery_case: recoveryCase } as Record<string, unknown>,
    description: classification.sentiment === 'negative' ? 'Captured negative feedback and routed it to recovery' : 'Captured CRM feedback',
    request,
    location_id: locationId,
  })

  return NextResponse.json({ data: { response, complaint, recovery_case: recoveryCase, recovery_required: classification.sentiment === 'negative' } }, { status: 201 })
}

async function resolveFeedbackReferences(input: {
  db: ReturnType<typeof createAdminClient>
  orgId: string
  surveyId?: string | null
  guestId?: string | null
  orderId?: string | null
  staffUserId?: string | null
  locationId?: string | null
}): Promise<{ data: { guest_id: string | null; location_id: string | null; staff_user_id: string | null }; error?: string }> {
  let guestId = input.guestId ?? null
  let locationId = input.locationId ?? null
  let staffUserId: string | null = input.staffUserId ?? null

  if (input.surveyId) {
    const { data: survey, error } = await input.db
      .from('crm_surveys')
      .select('id, location_id')
      .eq('id', input.surveyId)
      .eq('org_id', input.orgId)
      .maybeSingle()
    if (error || !survey) return { data: { guest_id: null, location_id: null, staff_user_id: null }, error: 'Survey not found for this organization' }
    locationId = locationId ?? (survey as { location_id: string | null }).location_id
  }

  if (locationId) {
    const { data: location, error } = await input.db
      .from('locations')
      .select('id')
      .eq('id', locationId)
      .eq('org_id', input.orgId)
      .maybeSingle()
    if (error || !location) return { data: { guest_id: null, location_id: null, staff_user_id: null }, error: 'Location not found for this organization' }
  }

  if (input.orderId) {
    const { data: order, error } = await input.db
      .from('orders')
      .select('id, org_id, location_id, server_id, metadata')
      .eq('id', input.orderId)
      .eq('org_id', input.orgId)
      .maybeSingle()
    if (error || !order) return { data: { guest_id: null, location_id: null, staff_user_id: null }, error: 'Order not found for this organization' }

    locationId = (order as { location_id: string | null }).location_id ?? locationId
    staffUserId = (order as { server_id: string | null }).server_id ?? null
    const metadataGuestId = ((order as { metadata?: Record<string, unknown> | null }).metadata ?? {}).crm_guest_id
    if (!guestId && typeof metadataGuestId === 'string') guestId = metadataGuestId
  }

  if (staffUserId) {
    const { data: staffUser, error } = await input.db
      .from('users')
      .select('id')
      .eq('id', staffUserId)
      .eq('org_id', input.orgId)
      .maybeSingle()
    if (error || !staffUser) return { data: { guest_id: null, location_id: null, staff_user_id: null }, error: 'Staff user not found for this organization' }
  }

  if (guestId) {
    const { data: guest, error } = await input.db
      .from('guests')
      .select('id, location_id')
      .eq('id', guestId)
      .eq('org_id', input.orgId)
      .maybeSingle()
    if (error || !guest) return { data: { guest_id: null, location_id: null, staff_user_id: null }, error: 'Guest not found for this organization' }
    locationId = locationId ?? (guest as { location_id: string | null }).location_id
  }

  return { data: { guest_id: guestId, location_id: locationId, staff_user_id: staffUserId } }
}

function complaintSourceType(sourceType: string): string {
  if (sourceType === 'email' || sourceType === 'sms') return 'email_sms'
  if (sourceType === 'manual') return 'manual_entry'
  if (sourceType === 'review_import') return 'review'
  return sourceType
}
