import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestManagerRoles } from '@/lib/crm/api'
import { mergeGuestCandidateSchema } from '@/lib/schemas/crm'

const transferableTables = [
  'guest_contact_points',
  'guest_identifiers',
  'guest_notes',
  'guest_preferences',
  'guest_allergies',
] as const

const guestIdOnlyTables = [
  'guest_tags',
  'guest_timeline_events',
] as const

async function loadCandidate(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  input: { candidate_id?: string; primary_guest_id: string; secondary_guest_id: string }
) {
  if (input.candidate_id) {
    const { data } = await supabase
      .from('guest_merge_candidates')
      .select('*')
      .eq('id', input.candidate_id)
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .single()
    return data
  }

  const { data } = await supabase
    .from('guest_merge_candidates')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .or(`and(primary_guest_id.eq.${input.primary_guest_id},candidate_guest_id.eq.${input.secondary_guest_id}),and(primary_guest_id.eq.${input.secondary_guest_id},candidate_guest_id.eq.${input.primary_guest_id})`)
    .single()
  return data
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestManagerRoles])
  if (roleErr) return roleErr

  const body = await request.json().catch(() => null)
  const parsed = mergeGuestCandidateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }
  if (parsed.data.primary_guest_id === parsed.data.secondary_guest_id) {
    return apiError(400, 'Guests must be different')
  }

  const supabase = createAdminClient()
  const { data: guests } = await supabase
    .from('guests')
    .select('*')
    .eq('org_id', user.org_id)
    .in('id', [parsed.data.primary_guest_id, parsed.data.secondary_guest_id])
    .is('deleted_at', null)

  const primary = (guests ?? []).find((guest: { id: string }) => guest.id === parsed.data.primary_guest_id)
  const secondary = (guests ?? []).find((guest: { id: string }) => guest.id === parsed.data.secondary_guest_id)
  if (!primary || !secondary) {
    return apiError(404, 'Guest not found')
  }

  const candidate = await loadCandidate(supabase, user.org_id, parsed.data)
  if (!candidate) {
    return apiError(404, 'Merge candidate evidence is required')
  }
  if (Number(candidate.confidence) < 75) {
    return apiError(409, 'Weak matches are suggestion-only and cannot be merged')
  }

  for (const table of transferableTables) {
    await supabase
      .from(table)
      .update({ guest_id: primary.id, updated_at: new Date().toISOString() } as never)
      .eq('org_id', user.org_id)
      .eq('guest_id', secondary.id)
  }

  for (const table of guestIdOnlyTables) {
    await supabase
      .from(table)
      .update({ guest_id: primary.id } as never)
      .eq('org_id', user.org_id)
      .eq('guest_id', secondary.id)
  }

  const { data: linkedOrders } = await supabase
    .from('orders')
    .select('id, metadata')
    .eq('org_id', user.org_id)
    .contains('metadata', { crm_guest_id: secondary.id })

  for (const order of linkedOrders ?? []) {
    const metadata = { ...((order as { metadata: Record<string, unknown> | null }).metadata ?? {}), crm_guest_id: primary.id, crm_guest_merged_from_id: secondary.id }
    await supabase.from('orders').update({ metadata, updated_at: new Date().toISOString() }).eq('id', (order as { id: string }).id).eq('org_id', user.org_id)
  }

  const { data: updatedPrimary } = await supabase
    .from('guests')
    .update({
      total_visits: Math.max(Number(primary.total_visits ?? 0), Number(primary.total_visits ?? 0) + Number(secondary.total_visits ?? 0)),
      total_spend: Number(primary.total_spend ?? 0) + Number(secondary.total_spend ?? 0),
      last_visit_at: [primary.last_visit_at, secondary.last_visit_at].filter(Boolean).sort().at(-1) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', primary.id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  await supabase
    .from('guests')
    .update({
      profile_status: 'merged',
      merged_into_guest_id: primary.id,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: { ...((secondary.metadata as Record<string, unknown> | null) ?? {}), merged_into_guest_id: primary.id },
    })
    .eq('id', secondary.id)
    .eq('org_id', user.org_id)

  await supabase
    .from('guest_merge_candidates')
    .update({ status: 'merged', reviewed_by_user_id: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', candidate.id)
    .eq('org_id', user.org_id)

  await supabase.from('guest_timeline_events').insert({
    org_id: user.org_id,
    location_id: primary.location_id ?? secondary.location_id ?? null,
    guest_id: primary.id,
    actor_user_id: user.id,
    event_type: 'crm.guest.merged',
    event_source: 'crm',
    title: 'Guest profiles merged',
    body: `${secondary.display_name} was merged into ${primary.display_name}.`,
    visibility: 'manager',
    metadata: { merged_guest_id: secondary.id, candidate_id: candidate.id },
  })

  const { data: decision } = await supabase.from('guest_merge_decisions').insert({
    org_id: user.org_id,
    location_id: primary.location_id ?? secondary.location_id ?? null,
    candidate_id: candidate.id,
    decision_type: 'merge',
    primary_guest_id: primary.id,
    secondary_guest_id: secondary.id,
    confidence: candidate.confidence,
    evidence: candidate.evidence ?? {},
    before_state: { primary, secondary },
    after_state: { primary: updatedPrimary, secondary_status: 'merged', linked_order_count: linkedOrders?.length ?? 0 },
    reason: parsed.data.reason ?? null,
    decided_by_user_id: user.id,
  }).select().single()

  await audit.record({
    actor: user,
    action: 'crm_guest_merged',
    entity_type: 'guest',
    entity_id: primary.id,
    before_state: { primary, secondary },
    after_state: { primary: updatedPrimary, secondary_status: 'merged', decision_id: decision?.id ?? null },
    reason: parsed.data.reason ?? null,
    description: `Merged CRM guest ${secondary.display_name} into ${primary.display_name}`,
    request,
    location_id: primary.location_id ?? secondary.location_id ?? null,
  })

  return NextResponse.json({ data: { decision, guest: updatedPrimary } })
}
