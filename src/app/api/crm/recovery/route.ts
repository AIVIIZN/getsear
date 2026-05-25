import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { createRecoveryCaseFromComplaint, crmRecoveryManageRoles, crmRecoveryReadRoles } from '@/lib/crm/recovery'
import { createCrmRecoveryCaseSchema, listCrmRecoveryQuerySchema } from '@/lib/schemas/crm'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmRecoveryReadRoles])
  if (roleErr) return roleErr

  const parsed = listCrmRecoveryQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const db = createAdminClient()
  let query = db
    .from('crm_recovery_cases')
    .select('*, guests(id, display_name, lifecycle_stage, last_visit_at), crm_complaints(id, status, recovery_status), crm_recovery_actions(id, action_type, status_after, note, created_at), crm_recovery_followups(id, status, due_at, completed_at, outcome)', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('deadline_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.status) query = query.eq('status', parsed.data.status)
  if (parsed.data.severity) query = query.eq('severity', parsed.data.severity)
  if (parsed.data.guest_id) query = query.eq('guest_id', parsed.data.guest_id)
  if (parsed.data.assigned_manager_user_id) query = query.eq('assigned_manager_user_id', parsed.data.assigned_manager_user_id)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: 'Failed to fetch recovery cases' }, { status: 500 })

  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(request: NextRequest) {
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

  const parsed = createCrmRecoveryCaseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const db = createAdminClient()
  if (parsed.data.complaint_id) {
    const { data: complaint, error: complaintError } = await db
      .from('crm_complaints')
      .select('*')
      .eq('id', parsed.data.complaint_id)
      .eq('org_id', user.org_id)
      .maybeSingle()
    if (complaintError || !complaint) return NextResponse.json({ error: 'Complaint not found for this organization' }, { status: 400 })

    const { caseRow, error } = await createRecoveryCaseFromComplaint({ db, user, complaint: complaint as never })
    if (error || !caseRow) return NextResponse.json({ error: error ?? 'Failed to create recovery case' }, { status: 500 })
    return NextResponse.json({ data: caseRow }, { status: 201 })
  }

  const { data: references, error: referenceError } = await resolveRecoveryReferences({
    db,
    orgId: user.org_id,
    guestId: parsed.data.guest_id,
    orderId: parsed.data.order_id,
    staffUserId: parsed.data.staff_user_id,
    assignedManagerUserId: parsed.data.assigned_manager_user_id,
    locationId: parsed.data.location_id,
  })
  if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 })

  const now = new Date().toISOString()
  const status = references.assigned_manager_user_id ? 'assigned' : 'new'
  const { data: caseRow, error } = await db
    .from('crm_recovery_cases')
    .insert({
      org_id: user.org_id,
      location_id: references.location_id,
      guest_id: references.guest_id,
      order_id: parsed.data.order_id ?? null,
      staff_user_id: references.staff_user_id,
      source_type: parsed.data.source_type,
      severity: parsed.data.severity,
      status,
      issue_summary: parsed.data.issue_summary,
      issue_detail: parsed.data.issue_detail ?? null,
      topics: parsed.data.topics,
      assigned_manager_user_id: references.assigned_manager_user_id,
      assigned_at: references.assigned_manager_user_id ? now : null,
      deadline_at: parsed.data.deadline_at ?? null,
      ai_summary: parsed.data.ai_summary ?? null,
      recommended_action: parsed.data.recommended_action ?? null,
      followup_due_at: parsed.data.followup_due_at ?? null,
      created_by_user_id: user.id,
      updated_by_user_id: user.id,
      metadata: parsed.data.metadata,
    })
    .select()
    .single()

  if (error || !caseRow) return NextResponse.json({ error: 'Failed to create recovery case' }, { status: 500 })

  await db.from('crm_recovery_actions').insert({
    org_id: user.org_id,
    recovery_case_id: caseRow.id,
    action_type: status === 'assigned' ? 'assign' : 'status_change',
    status_after: status,
    actor_user_id: user.id,
    assigned_manager_user_id: references.assigned_manager_user_id,
    note: status === 'assigned' ? 'Recovery case opened and assigned.' : 'Recovery case opened.',
  })

  await audit.record({
    actor: user,
    action: 'crm_recovery_case_created',
    entity_type: 'crm_recovery_case',
    entity_id: caseRow.id,
    after_state: caseRow as Record<string, unknown>,
    description: 'Created CRM service recovery case',
    request,
    location_id: references.location_id,
  })

  return NextResponse.json({ data: caseRow }, { status: 201 })
}

async function resolveRecoveryReferences(input: {
  db: ReturnType<typeof createAdminClient>
  orgId: string
  guestId?: string | null
  orderId?: string | null
  staffUserId?: string | null
  assignedManagerUserId?: string | null
  locationId?: string | null
}): Promise<{ data: { guest_id: string | null; location_id: string | null; staff_user_id: string | null; assigned_manager_user_id: string | null }; error?: string }> {
  let guestId = input.guestId ?? null
  let locationId = input.locationId ?? null
  let staffUserId = input.staffUserId ?? null

  if (locationId) {
    const { data } = await input.db.from('locations').select('id').eq('id', locationId).eq('org_id', input.orgId).maybeSingle()
    if (!data) return { data: { guest_id: null, location_id: null, staff_user_id: null, assigned_manager_user_id: null }, error: 'Location not found for this organization' }
  }

  if (input.orderId) {
    const { data: order } = await input.db.from('orders').select('id, location_id, server_id, metadata').eq('id', input.orderId).eq('org_id', input.orgId).maybeSingle()
    if (!order) return { data: { guest_id: null, location_id: null, staff_user_id: null, assigned_manager_user_id: null }, error: 'Order not found for this organization' }
    locationId = (order as { location_id: string | null }).location_id ?? locationId
    staffUserId = (order as { server_id: string | null }).server_id ?? staffUserId
    const metadataGuestId = ((order as { metadata?: Record<string, unknown> | null }).metadata ?? {}).crm_guest_id
    if (!guestId && typeof metadataGuestId === 'string') guestId = metadataGuestId
  }

  if (guestId) {
    const { data: guest } = await input.db.from('guests').select('id, location_id').eq('id', guestId).eq('org_id', input.orgId).maybeSingle()
    if (!guest) return { data: { guest_id: null, location_id: null, staff_user_id: null, assigned_manager_user_id: null }, error: 'Guest not found for this organization' }
    locationId = locationId ?? (guest as { location_id: string | null }).location_id
  }

  for (const [id, label] of [[staffUserId, 'Staff user'], [input.assignedManagerUserId ?? null, 'Assigned manager']] as const) {
    if (!id) continue
    const { data: staff } = await input.db.from('users').select('id').eq('id', id).eq('org_id', input.orgId).maybeSingle()
    if (!staff) return { data: { guest_id: null, location_id: null, staff_user_id: null, assigned_manager_user_id: null }, error: `${label} not found for this organization` }
  }

  return { data: { guest_id: guestId, location_id: locationId, staff_user_id: staffUserId, assigned_manager_user_id: input.assignedManagerUserId ?? null } }
}
