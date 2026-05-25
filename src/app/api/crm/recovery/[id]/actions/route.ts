import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmRecoveryManageRoles } from '@/lib/crm/recovery'
import { createCrmRecoveryActionSchema } from '@/lib/schemas/crm'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmRecoveryManageRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createCrmRecoveryActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { id } = await params
  const db = createAdminClient()
  const { data: current } = await db.from('crm_recovery_cases').select('*').eq('id', id).eq('org_id', user.org_id).maybeSingle()
  if (!current) return NextResponse.json({ error: 'Recovery case not found for this organization' }, { status: 404 })

  if (parsed.data.assigned_manager_user_id) {
    const { data: manager } = await db.from('users').select('id').eq('id', parsed.data.assigned_manager_user_id).eq('org_id', user.org_id).maybeSingle()
    if (!manager) return NextResponse.json({ error: 'Assigned manager not found for this organization' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const statusAfter = parsed.data.status_after ?? statusForAction(parsed.data.action_type, (current as { status: string }).status)
  const updates: Record<string, unknown> = {
    status: statusAfter,
    updated_by_user_id: user.id,
    updated_at: now,
  }
  if (parsed.data.assigned_manager_user_id !== undefined) {
    updates.assigned_manager_user_id = parsed.data.assigned_manager_user_id
    updates.assigned_at = parsed.data.assigned_manager_user_id ? now : null
  }
  if (parsed.data.followup_due_at !== undefined) updates.followup_due_at = parsed.data.followup_due_at
  if (statusAfter === 'resolved') updates.resolved_at = now
  if (statusAfter === 'closed') updates.closed_at = now

  const { data: updated, error: updateError } = await db
    .from('crm_recovery_cases')
    .update(updates)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()
  if (updateError || !updated) return NextResponse.json({ error: 'Failed to update recovery case' }, { status: 500 })

  const { data: action, error: actionError } = await db
    .from('crm_recovery_actions')
    .insert({
      org_id: user.org_id,
      recovery_case_id: id,
      action_type: parsed.data.action_type,
      status_before: (current as { status: string }).status,
      status_after: statusAfter,
      actor_user_id: user.id,
      assigned_manager_user_id: parsed.data.assigned_manager_user_id ?? null,
      note: parsed.data.note ?? null,
      value_cents: parsed.data.value_cents,
      metadata: parsed.data.metadata,
    })
    .select()
    .single()
  if (actionError || !action) return NextResponse.json({ error: 'Recovery case updated but action log failed' }, { status: 409 })

  if (parsed.data.followup_due_at) {
    await db.from('crm_recovery_followups').insert({
      org_id: user.org_id,
      recovery_case_id: id,
      guest_id: (updated as { guest_id: string | null }).guest_id,
      status: 'scheduled',
      due_at: parsed.data.followup_due_at,
      note: parsed.data.note ?? null,
      created_by_user_id: user.id,
    })
  }

  await audit.record({
    actor: user,
    action: 'crm_recovery_action_logged',
    entity_type: 'crm_recovery_case',
    entity_id: id,
    before_state: current as Record<string, unknown>,
    after_state: { updated, action } as Record<string, unknown>,
    description: 'Logged CRM service recovery action',
    request,
    location_id: (updated as { location_id: string | null }).location_id,
  })

  return NextResponse.json({ data: { case: updated, action } })
}

function statusForAction(actionType: string, fallback: string): string {
  if (actionType === 'assign') return 'assigned'
  if (actionType === 'resolve') return 'resolved'
  if (actionType === 'close') return 'closed'
  if (actionType === 'escalate') return 'escalated'
  if (actionType === 'guest_message' || actionType === 'call' || actionType === 'email' || actionType === 'sms') return 'waiting_for_guest'
  if (actionType === 'manager_note' || actionType === 'status_change') return fallback
  return 'in_progress'
}
