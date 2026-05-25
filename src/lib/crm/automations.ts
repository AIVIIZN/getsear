import type { AuthUser } from '@/lib/api/auth'
import { createRecoveryCaseFromComplaint } from '@/lib/crm/recovery'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { z } from 'zod'
import type { createCrmAutomationSchema, testCrmAutomationSchema } from '@/lib/schemas/crm'

type Db = ReturnType<typeof createAdminClient>

export const crmAutomationManageRoles = ['platform_admin', 'owner', 'admin', 'manager', 'marketing'] as const
export const crmAutomationReadRoles = [...crmAutomationManageRoles, 'analyst'] as const

export type CrmAutomationInput = z.infer<typeof createCrmAutomationSchema>
export type CrmAutomationTestInput = z.infer<typeof testCrmAutomationSchema>

type AutomationRow = {
  id: string
  org_id: string
  location_id: string | null
  trigger_type: string
  status: string
  name: string
}

type AutomationAction = {
  id: string
  action_type: string
  config: Record<string, unknown> | null
}

type ComplaintRow = Parameters<typeof createRecoveryCaseFromComplaint>[0]['complaint']

function automationCanRun(automation: AutomationRow): { ok: boolean; reason?: string } {
  if (automation.status === 'paused') return { ok: false, reason: 'Automation is paused.' }
  if (automation.status === 'archived') return { ok: false, reason: 'Automation is archived.' }
  if (automation.status === 'draft') return { ok: false, reason: 'Automation is still a draft.' }
  return { ok: true }
}

async function resolveAutomation(db: Db, orgId: string, automationId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: automation, error } = await (db.from('crm_automations') as any)
    .select('id, org_id, location_id, trigger_type, status, name')
    .eq('id', automationId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !automation) return { automation: null, actions: [], error: 'Automation not found for this organization' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actions, error: actionsError } = await (db.from('crm_automation_actions') as any)
    .select('id, action_type, config')
    .eq('org_id', orgId)
    .eq('automation_id', automation.id)
    .eq('is_active', true)
    .order('step_order', { ascending: true })

  if (actionsError) return { automation: null, actions: [], error: 'Failed to load automation actions' }
  return { automation: automation as AutomationRow, actions: (actions ?? []) as AutomationAction[], error: null }
}

async function resolveComplaint(db: Db, orgId: string, complaintId: string): Promise<ComplaintRow | null> {
  const { data } = await db
    .from('crm_complaints')
    .select('*')
    .eq('id', complaintId)
    .eq('org_id', orgId)
    .maybeSingle()
  return data as ComplaintRow | null
}

async function resolveLapsedGuest(db: Db, orgId: string, guestId: string) {
  const { data: guest } = await db
    .from('guests')
    .select('id, org_id, location_id, display_name, lifecycle_stage, last_visit_at')
    .eq('id', guestId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (!guest) return { ok: false, reason: 'Guest not found for this organization' }
  if ((guest as { lifecycle_stage?: string | null }).lifecycle_stage !== 'lapsed') {
    return { ok: false, reason: 'Guest is not currently lapsed.' }
  }
  return { ok: true, guest }
}

export async function createCrmAutomation(input: {
  db: Db
  user: Pick<AuthUser, 'id' | 'org_id'>
  automation: CrmAutomationInput
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: automation, error } = await (input.db.from('crm_automations') as any)
    .insert({
      org_id: input.user.org_id,
      location_id: input.automation.location_id ?? null,
      segment_id: input.automation.segment_id ?? null,
      created_by_user_id: input.user.id,
      updated_by_user_id: input.user.id,
      name: input.automation.name,
      description: input.automation.description ?? null,
      status: input.automation.status,
      trigger_type: input.automation.trigger_type,
      condition_tree: input.automation.condition_tree,
      wait_steps: input.automation.wait_steps,
      branch_rules: input.automation.branch_rules,
      measurement: input.automation.measurement,
      metadata: input.automation.metadata,
    })
    .select()
    .single()

  if (error || !automation) return { automation: null, error: 'Failed to create automation' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (input.db.from('crm_automation_triggers') as any).insert({
    org_id: input.user.org_id,
    automation_id: automation.id,
    trigger_type: input.automation.trigger_type,
    config: input.automation.condition_tree,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (input.db.from('crm_automation_actions') as any).insert(input.automation.actions.map((action, index) => ({
    org_id: input.user.org_id,
    automation_id: automation.id,
    step_order: index,
    action_type: action.action_type,
    config: action.config,
  })))

  return { automation: automation as Record<string, unknown>, error: null }
}

export async function runCrmAutomation(input: {
  db: Db
  user: Pick<AuthUser, 'id' | 'org_id'>
  automationId: string
  testInput: CrmAutomationTestInput
  mode: 'test' | 'run'
}) {
  const { automation, actions, error } = await resolveAutomation(input.db, input.user.org_id, input.automationId)
  if (error || !automation) return { result: null, error: error ?? 'Automation not found', status: 404 }

  const runnable = input.mode === 'test' ? { ok: true } : automationCanRun(automation)
  if (!runnable.ok) return { result: null, error: runnable.reason ?? 'Automation cannot run.', status: 409 }

  if (automation.trigger_type === 'lapsed') {
    if (!input.testInput.guest_id) return { result: null, error: 'Lapsed automation needs guest_id.', status: 400 }
    const guest = await resolveLapsedGuest(input.db, input.user.org_id, input.testInput.guest_id)
    if (!guest.ok) return { result: null, error: guest.reason ?? 'Guest failed automation conditions.', status: 422 }
  }

  if (automation.trigger_type === 'negative_feedback' && !input.testInput.complaint_id) {
    return { result: null, error: 'Negative feedback automation needs complaint_id.', status: 400 }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: enrollment } = await (input.db.from('crm_automation_enrollments') as any)
    .insert({
      org_id: input.user.org_id,
      automation_id: automation.id,
      guest_id: input.testInput.guest_id ?? null,
      source_type: automation.trigger_type,
      source_id: input.testInput.complaint_id ?? input.testInput.guest_id ?? null,
      status: input.mode === 'test' ? 'completed' : 'enrolled',
      metadata: { ...input.testInput.metadata, mode: input.mode },
    })
    .select()
    .single()

  const startedAt = new Date().toISOString()
  const executed: Array<Record<string, unknown>> = []
  let runStatus = input.mode === 'test' ? 'test' : 'succeeded'
  let runResult: Record<string, unknown> = { mode: input.mode, trigger_type: automation.trigger_type }
  let errorMessage: string | null = null

  for (const action of actions) {
    if (action.action_type === 'create_recovery') {
      const complaintId = input.testInput.complaint_id
      if (!complaintId) continue
      const complaint = await resolveComplaint(input.db, input.user.org_id, complaintId)
      if (!complaint) {
        runStatus = 'failed'
        errorMessage = 'Complaint not found for this organization'
        break
      }
      if (input.mode === 'run' && !input.testInput.dry_run) {
        const recovery = await createRecoveryCaseFromComplaint({ db: input.db, user: input.user, complaint })
        if (recovery.error || !recovery.caseRow) {
          runStatus = 'failed'
          errorMessage = recovery.error ?? 'Failed to create recovery case'
          break
        }
        runResult = { ...runResult, recovery_case_id: recovery.caseRow.id }
      } else {
        runResult = { ...runResult, would_create_recovery_case: true, complaint_id: complaint.id }
      }
    }
    executed.push({ action_id: action.id, action_type: action.action_type, dry_run: input.testInput.dry_run || input.mode === 'test' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: run } = await (input.db.from('crm_automation_runs') as any)
    .insert({
      org_id: input.user.org_id,
      automation_id: automation.id,
      enrollment_id: enrollment?.id ?? null,
      guest_id: input.testInput.guest_id ?? null,
      trigger_type: automation.trigger_type,
      status: runStatus,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      actions_executed: executed,
      result: runResult,
      error_message: errorMessage,
      metadata: { ...input.testInput.metadata, mode: input.mode },
    })
    .select()
    .single()

  if (runStatus === 'failed') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (input.db.from('crm_automation_failures') as any).insert({
      org_id: input.user.org_id,
      automation_id: automation.id,
      run_id: run?.id ?? null,
      failure_type: 'action_failed',
      message: errorMessage ?? 'Automation failed',
      metadata: runResult,
    })
  } else if (input.mode === 'run') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (input.db.from('crm_automations') as any)
      .update({ last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', automation.id)
      .eq('org_id', input.user.org_id)
  }

  return { result: { automation, run, actions_executed: executed, result: runResult }, error: errorMessage, status: runStatus === 'failed' ? 500 : 200 }
}
