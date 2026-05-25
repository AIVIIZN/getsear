import type { AuthUser } from '@/lib/api/auth'
import type { createAdminClient } from '@/lib/supabase/admin'

export const crmRecoveryManageRoles = ['platform_admin', 'owner', 'admin', 'manager'] as const
export const crmRecoveryReadRoles = [...crmRecoveryManageRoles, 'marketing', 'analyst'] as const

type Db = ReturnType<typeof createAdminClient>

type ComplaintRow = {
  id: string
  org_id: string
  location_id: string | null
  guest_id: string | null
  order_id: string | null
  staff_user_id: string | null
  source_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  topics: string[]
  issue_summary: string
  complaint_text: string | null
}

export type RecoveryCaseSource = 'low_score' | 'bad_review' | 'refund' | 'comp' | 'void' | 'long_wait' | 'manager_note' | 'complaint_tag' | 'churn_after_issue' | 'manual'

export type RecoveryAnalyticsCase = {
  id: string
  status: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  topics: string[] | null
  created_at: string
  resolved_at: string | null
  recovered_at: string | null
  recovered_revenue: number | string | null
}

export type RecoveryAnalytics = {
  opened_count: number
  resolved_count: number
  average_resolution_hours: number | null
  recovered_guest_count: number
  recovered_revenue: number
  top_issues: Array<{ topic: string; count: number }>
}

export type ReviewRequestDraft = {
  status: 'draft'
  approval_required: true
  editable_fields: ['subject', 'message_body', 'sms_body', 'review_url']
  subject: string
  message_body: string
  sms_body: string
  review_url: string | null
  metadata: {
    source: 'crm_positive_private_feedback'
    survey_response_id?: string
    review_id?: string
    guest_id?: string | null
    rating?: number | null
  }
}

export function recoverySourceFromComplaint(complaint: Pick<ComplaintRow, 'source_type'>): RecoveryCaseSource {
  if (complaint.source_type === 'review') return 'bad_review'
  if (complaint.source_type === 'receipt_qr' || complaint.source_type === 'survey_response') return 'low_score'
  return 'complaint_tag'
}

export function recoveryDeadlineForSeverity(severity: 'low' | 'medium' | 'high' | 'critical'): string {
  const hours = severity === 'critical' ? 4 : severity === 'high' ? 12 : severity === 'medium' ? 24 : 72
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

export function recommendedRecoveryAction(input: { severity: 'low' | 'medium' | 'high' | 'critical'; topics: string[] }): string {
  if (input.severity === 'critical') return 'Owner or GM should contact the guest before next service and document the resolution.'
  if (input.topics.includes('speed')) return 'Manager apology plus a return-visit comp tied to faster service follow-up.'
  if (input.topics.includes('food')) return 'Invite the guest back with a manager-reviewed replacement or comped item.'
  if (input.topics.includes('service')) return 'Assign a manager call, capture staff context, and schedule a follow-up task.'
  return 'Assign a manager, acknowledge the issue, and record whether the guest returns.'
}

export function buildReviewRequestDraft(input: {
  guestName?: string | null
  rating?: number | null
  reviewUrl?: string | null
  surveyResponseId?: string
  reviewId?: string
  guestId?: string | null
}): ReviewRequestDraft {
  const greeting = input.guestName ? `Hi ${input.guestName}` : 'Hi'
  return {
    status: 'draft',
    approval_required: true,
    editable_fields: ['subject', 'message_body', 'sms_body', 'review_url'],
    subject: 'Would you share your visit?',
    message_body: `${greeting}, thank you for the kind feedback. If you have a minute, would you share the same note publicly so nearby guests can find us?`,
    sms_body: 'Thanks for the kind feedback. Would you share a quick public review? Reply STOP to opt out.',
    review_url: input.reviewUrl ?? null,
    metadata: {
      source: 'crm_positive_private_feedback',
      survey_response_id: input.surveyResponseId,
      review_id: input.reviewId,
      guest_id: input.guestId ?? null,
      rating: input.rating ?? null,
    },
  }
}

export function summarizeRecoveryAnalytics(cases: RecoveryAnalyticsCase[]): RecoveryAnalytics {
  const topicCounts = new Map<string, number>()
  let resolvedHoursTotal = 0
  let resolvedWithTiming = 0
  let recoveredGuestCount = 0
  let recoveredRevenue = 0

  for (const item of cases) {
    for (const topic of item.topics ?? []) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1)
    }

    if (item.resolved_at) {
      const createdAt = new Date(item.created_at).getTime()
      const resolvedAt = new Date(item.resolved_at).getTime()
      if (!Number.isNaN(createdAt) && !Number.isNaN(resolvedAt) && resolvedAt >= createdAt) {
        resolvedHoursTotal += (resolvedAt - createdAt) / (1000 * 60 * 60)
        resolvedWithTiming += 1
      }
    }

    const revenue = Number(item.recovered_revenue ?? 0)
    if (item.recovered_at || revenue > 0) recoveredGuestCount += 1
    if (Number.isFinite(revenue)) recoveredRevenue += revenue
  }

  return {
    opened_count: cases.length,
    resolved_count: cases.filter((item) => item.status === 'resolved' || item.status === 'closed').length,
    average_resolution_hours: resolvedWithTiming > 0 ? Number((resolvedHoursTotal / resolvedWithTiming).toFixed(2)) : null,
    recovered_guest_count: recoveredGuestCount,
    recovered_revenue: Number(recoveredRevenue.toFixed(2)),
    top_issues: Array.from(topicCounts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
      .slice(0, 5),
  }
}

export async function createRecoveryCaseFromComplaint(input: {
  db: Db
  user: Pick<AuthUser, 'id' | 'org_id'>
  complaint: ComplaintRow
}): Promise<{ caseRow: Record<string, unknown> | null; error?: string }> {
  const { data: existing } = await input.db
    .from('crm_recovery_cases')
    .select('*')
    .eq('org_id', input.user.org_id)
    .eq('complaint_id', input.complaint.id)
    .maybeSingle()
  if (existing) return { caseRow: existing as Record<string, unknown> }

  const deadlineAt = recoveryDeadlineForSeverity(input.complaint.severity)
  const { data: caseRow, error } = await input.db
    .from('crm_recovery_cases')
    .insert({
      org_id: input.user.org_id,
      location_id: input.complaint.location_id,
      guest_id: input.complaint.guest_id,
      order_id: input.complaint.order_id,
      staff_user_id: input.complaint.staff_user_id,
      complaint_id: input.complaint.id,
      source_type: recoverySourceFromComplaint(input.complaint),
      severity: input.complaint.severity,
      status: 'new',
      issue_summary: input.complaint.issue_summary,
      issue_detail: input.complaint.complaint_text,
      topics: input.complaint.topics,
      deadline_at: deadlineAt,
      ai_summary: input.complaint.issue_summary,
      recommended_action: recommendedRecoveryAction({ severity: input.complaint.severity, topics: input.complaint.topics }),
      followup_due_at: deadlineAt,
      created_by_user_id: input.user.id,
      updated_by_user_id: input.user.id,
      metadata: {
        source_complaint_id: input.complaint.id,
        ai_draft: {
          status: 'pending_approval',
          approval_required: true,
          editable_fields: ['ai_summary', 'recommended_action', 'followup_due_at'],
        },
      },
    })
    .select()
    .single()

  if (error || !caseRow) return { caseRow: null, error: 'Failed to create recovery case' }

  await input.db.from('crm_recovery_actions').insert({
    org_id: input.user.org_id,
    recovery_case_id: (caseRow as { id: string }).id,
    action_type: 'status_change',
    status_after: 'new',
    actor_user_id: input.user.id,
    note: 'Negative feedback opened a service recovery case.',
    metadata: { complaint_id: input.complaint.id },
  })

  await input.db
    .from('crm_complaints')
    .update({ status: 'linked_to_recovery', recovery_status: 'routed', updated_at: new Date().toISOString() })
    .eq('id', input.complaint.id)
    .eq('org_id', input.user.org_id)

  return { caseRow: caseRow as Record<string, unknown> }
}

export function canManageRecovery(user: Pick<AuthUser, 'role'>): boolean {
  return crmRecoveryManageRoles.includes(user.role as never)
}
