import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmRecoveryManageRoles } from '@/lib/crm/recovery'
import { resolveCrmRecoveryCaseSchema } from '@/lib/schemas/crm'
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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = resolveCrmRecoveryCaseSchema.safeParse(body)
  if (!parsed.success) return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })

  const { id } = await params
  const db = createAdminClient()
  const { data: current } = await db.from('crm_recovery_cases').select('*').eq('id', id).eq('org_id', user.org_id).maybeSingle()
  if (!current) return apiError(404, 'Recovery case not found for this organization')

  const recovered = parsed.data.recovered_order_id
    ? await resolveRecoveredOrder(db, user.org_id, parsed.data.recovered_order_id, (current as { guest_id: string | null }).guest_id)
    : { data: null as null, error: undefined }
  if (recovered.error) return apiError(400, recovered.error)

  const now = new Date().toISOString()
  const { data: updated, error } = await db
    .from('crm_recovery_cases')
    .update({
      status: 'resolved',
      resolution_summary: parsed.data.resolution_summary,
      resolved_at: now,
      followup_due_at: parsed.data.followup_due_at ?? null,
      recovered_order_id: recovered.data?.id ?? null,
      recovered_at: recovered.data?.closed_at ?? null,
      recovered_revenue: recovered.data?.total ?? 0,
      updated_by_user_id: user.id,
      updated_at: now,
      metadata: { ...((current as { metadata?: Record<string, unknown> | null }).metadata ?? {}), ...parsed.data.metadata },
    })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()
  if (error || !updated) return apiError(500, 'Failed to resolve recovery case')

  const { data: action } = await db.from('crm_recovery_actions').insert({
    org_id: user.org_id,
    recovery_case_id: id,
    action_type: 'resolve',
    status_before: (current as { status: string }).status,
    status_after: 'resolved',
    actor_user_id: user.id,
    note: parsed.data.resolution_summary,
    metadata: { recovered_order_id: recovered.data?.id ?? null },
  }).select().single()

  if (parsed.data.followup_due_at) {
    await db.from('crm_recovery_followups').insert({
      org_id: user.org_id,
      recovery_case_id: id,
      guest_id: (updated as { guest_id: string | null }).guest_id,
      order_id: recovered.data?.id ?? null,
      status: 'scheduled',
      due_at: parsed.data.followup_due_at,
      created_by_user_id: user.id,
    })
  }

  if ((updated as { guest_id: string | null }).guest_id) {
    await db.from('guest_timeline_events').insert({
      org_id: user.org_id,
      location_id: (updated as { location_id: string | null }).location_id,
      guest_id: (updated as { guest_id: string }).guest_id,
      event_type: 'crm.recovery.resolved',
      event_source: 'crm_recovery',
      actor_user_id: user.id,
      order_id: recovered.data?.id ?? null,
      title: 'Service recovery resolved',
      body: parsed.data.resolution_summary,
      visibility: 'manager',
      metadata: { recovery_case_id: id, recovered_order_id: recovered.data?.id ?? null },
    })
  }

  await audit.record({
    actor: user,
    action: 'crm_recovery_case_resolved',
    entity_type: 'crm_recovery_case',
    entity_id: id,
    before_state: current as Record<string, unknown>,
    after_state: { updated, action } as Record<string, unknown>,
    description: 'Resolved CRM service recovery case',
    request,
    location_id: (updated as { location_id: string | null }).location_id,
  })

  return NextResponse.json({ data: { case: updated, action } })
}

async function resolveRecoveredOrder(db: ReturnType<typeof createAdminClient>, orgId: string, orderId: string, guestId: string | null) {
  const { data: order } = await db
    .from('orders')
    .select('id, total, closed_at, metadata')
    .eq('id', orderId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (!order) return { data: null, error: 'Recovered order not found for this organization' }
  const metadataGuestId = ((order as { metadata?: Record<string, unknown> | null }).metadata ?? {}).crm_guest_id
  if (guestId && metadataGuestId !== guestId) return { data: null, error: 'Recovered order is not attached to this recovery case guest' }
  return { data: order as { id: string; total: number; closed_at: string | null }, error: undefined }
}
