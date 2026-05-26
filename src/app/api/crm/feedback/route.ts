import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { classifyCrmFeedback, crmComplaintSummary, crmFeedbackReadRoles, crmFeedbackManageRoles } from '@/lib/crm/feedback'
import { buildReviewRequestDraft, createRecoveryCaseFromComplaint } from '@/lib/crm/recovery'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCrmSurveyResponseSchema, listCrmFeedbackQuerySchema } from '@/lib/schemas/crm'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmFeedbackReadRoles])
  if (roleErr) return roleErr

  const parsed = listCrmFeedbackQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
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
  if (error) return apiError(500, 'Failed to fetch feedback')

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

  const parsed = createCrmSurveyResponseSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
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
  if (referenceError) return apiError(400, referenceError)

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

  if (error || !response) return apiError(500, 'Failed to create feedback response')

  let complaint = null
  let recoveryCase = null
  let reviewRequestDraft = null
  let managerNotification = null
  let operationsInsight = null
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
      return apiError(409, 'Feedback saved but recovery routing failed')
    }
    complaint = complaintRow
    const { caseRow, error: recoveryError } = await createRecoveryCaseFromComplaint({ db, user, complaint: complaintRow })
    if (recoveryError || !caseRow) {
      return apiError(409, 'Feedback saved but recovery case creation failed')
    }
    recoveryCase = caseRow
    operationsInsight = await createRepeatedIssueInsight({
      db,
      orgId: user.org_id,
      locationId,
      topic: classification.topics[0] ?? null,
      complaintId: complaintRow.id,
    })
  } else if (parsed.data.rating === 5) {
    reviewRequestDraft = buildReviewRequestDraft({
      rating: parsed.data.rating,
      surveyResponseId: response.id,
      guestId: references.guest_id,
      reviewUrl: typeof parsed.data.metadata.public_review_url === 'string' ? parsed.data.metadata.public_review_url : null,
    })
  }

  if (classification.topics.includes('staff_compliment') && locationId) {
    managerNotification = await notifyManagerOfStaffCompliment({
      db,
      orgId: user.org_id,
      locationId,
      guestId: references.guest_id,
      orderId: parsed.data.order_id ?? null,
      staffUserId: references.staff_user_id,
      actorUserId: user.id,
      responseId: response.id,
      body: parsed.data.response_text ?? null,
    })
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
      title: classification.sentiment === 'negative'
        ? 'Negative feedback routed to recovery'
        : reviewRequestDraft
          ? 'Five-star feedback ready for public review ask'
          : 'Guest feedback received',
      body: parsed.data.response_text ?? null,
      visibility: classification.sentiment === 'negative' || reviewRequestDraft ? 'manager' : 'service',
      metadata: {
        response_id: response.id,
        complaint_id: complaint?.id ?? null,
        recovery_case_id: recoveryCase?.id ?? null,
        review_request_draft: reviewRequestDraft,
        manager_notification: managerNotification,
        operations_insight: operationsInsight,
        topics: classification.topics,
      },
    })
  }

  await audit.record({
    actor: user,
    action: classification.sentiment === 'negative' ? 'crm_negative_feedback_routed' : 'crm_feedback_created',
    entity_type: 'crm_survey_response',
    entity_id: response.id,
    after_state: { response, complaint, recovery_case: recoveryCase, review_request_draft: reviewRequestDraft, manager_notification: managerNotification, operations_insight: operationsInsight } as Record<string, unknown>,
    description: classification.sentiment === 'negative' ? 'Captured negative feedback and routed it to recovery' : 'Captured CRM feedback',
    request,
    location_id: locationId,
  })

  return NextResponse.json({
    data: {
      response,
      complaint,
      recovery_case: recoveryCase,
      recovery_required: classification.sentiment === 'negative',
      review_request_draft: reviewRequestDraft,
      manager_notification: managerNotification,
      operations_insight: operationsInsight,
    },
  }, { status: 201 })
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

async function notifyManagerOfStaffCompliment(input: {
  db: ReturnType<typeof createAdminClient>
  orgId: string
  locationId: string
  guestId: string | null
  orderId: string | null
  staffUserId: string | null
  actorUserId: string
  responseId: string
  body: string | null
}) {
  const title = 'Staff compliment captured'
  const summary = input.body?.trim() || 'A guest left positive staff feedback.'

  if (input.guestId) {
    await input.db.from('guest_timeline_events').insert({
      org_id: input.orgId,
      location_id: input.locationId,
      guest_id: input.guestId,
      event_type: 'crm.staff_compliment.manager_notice',
      event_source: 'crm_feedback',
      actor_user_id: input.actorUserId,
      order_id: input.orderId,
      title,
      body: summary,
      visibility: 'manager',
      metadata: { response_id: input.responseId, staff_user_id: input.staffUserId },
    })
  }

  await input.db.from('ai_insights').insert({
    org_id: input.orgId,
    location_id: input.locationId,
    category: 'general',
    priority: 'low',
    title,
    summary,
    details: 'Positive guest feedback mentioned a staff compliment. Review it with the manager before using it in coaching or recognition.',
    metric_value: null,
    comparison_text: null,
  })

  return { status: 'manager_notified', channel: 'timeline_and_insights' }
}

async function createRepeatedIssueInsight(input: {
  db: ReturnType<typeof createAdminClient>
  orgId: string
  locationId: string | null
  topic: string | null
  complaintId: string
}) {
  if (!input.locationId || !input.topic) return null

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await input.db
    .from('crm_complaints')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', input.orgId)
    .eq('location_id', input.locationId)
    .contains('topics', [input.topic])
    .gte('created_at', since)

  if ((count ?? 0) < 3) return null

  const title = `Repeated ${input.topic.replaceAll('_', ' ')} feedback`
  const { data: existing } = await input.db
    .from('ai_insights')
    .select('id')
    .eq('org_id', input.orgId)
    .eq('location_id', input.locationId)
    .eq('title', title)
    .eq('is_dismissed', false)
    .gte('generated_at', since)
    .maybeSingle()
  if (existing) return { status: 'existing_insight', insight_id: existing.id }

  const { data } = await input.db
    .from('ai_insights')
    .insert({
      org_id: input.orgId,
      location_id: input.locationId,
      category: 'general',
      priority: 'medium',
      title,
      summary: `${count} complaints in the last 30 days mention ${input.topic.replaceAll('_', ' ')}.`,
      details: 'Service recovery detected a repeated issue pattern. Review staffing, prep, or service steps before the next rush.',
      metric_value: String(count),
      comparison_text: '30-day complaint pattern',
    })
    .select('id')
    .single()

  return { status: 'created_insight', insight_id: data?.id ?? null, complaint_id: input.complaintId, count }
}
