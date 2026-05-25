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
      metadata: { source_complaint_id: input.complaint.id },
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
