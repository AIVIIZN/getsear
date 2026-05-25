import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestManagerRoles } from '@/lib/crm/api'
import { markGuestHouseholdSchema } from '@/lib/schemas/crm'

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestManagerRoles])
  if (roleErr) return roleErr

  const body = await request.json().catch(() => null)
  const parsed = markGuestHouseholdSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }
  if (parsed.data.primary_guest_id === parsed.data.secondary_guest_id) {
    return NextResponse.json({ error: 'Guests must be different' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: guests } = await supabase
    .from('guests')
    .select('id, display_name, location_id')
    .eq('org_id', user.org_id)
    .in('id', [parsed.data.primary_guest_id, parsed.data.secondary_guest_id])
    .is('deleted_at', null)

  const primary = (guests ?? []).find((guest: { id: string }) => guest.id === parsed.data.primary_guest_id)
  const secondary = (guests ?? []).find((guest: { id: string }) => guest.id === parsed.data.secondary_guest_id)
  if (!primary || !secondary) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
  }

  let candidate: Record<string, unknown> | null = null
  if (parsed.data.candidate_id) {
    const { data } = await supabase
      .from('guest_merge_candidates')
      .select('*')
      .eq('id', parsed.data.candidate_id)
      .eq('org_id', user.org_id)
      .eq('status', 'pending')
      .single()
    candidate = data as Record<string, unknown> | null
  }

  const { data: household } = await supabase.from('guest_households').insert({
    org_id: user.org_id,
    location_id: primary.location_id ?? secondary.location_id ?? null,
    name: parsed.data.household_name ?? `${primary.display_name} household`,
    primary_guest_id: primary.id,
    created_by_user_id: user.id,
    metadata: { source: 'identity_resolution', candidate_id: parsed.data.candidate_id ?? null },
  }).select().single()

  await supabase.from('guest_relationships').insert({
    org_id: user.org_id,
    location_id: primary.location_id ?? secondary.location_id ?? null,
    household_id: household?.id ?? null,
    source_guest_id: primary.id,
    related_guest_id: secondary.id,
    relationship_type: parsed.data.relationship_type,
    created_by_user_id: user.id,
  })

  if (candidate) {
    await supabase
      .from('guest_merge_candidates')
      .update({ status: 'household', reviewed_by_user_id: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', candidate.id)
      .eq('org_id', user.org_id)
  }

  const { data: decision } = await supabase.from('guest_merge_decisions').insert({
    org_id: user.org_id,
    location_id: primary.location_id ?? secondary.location_id ?? null,
    candidate_id: parsed.data.candidate_id ?? null,
    decision_type: 'mark_household',
    primary_guest_id: primary.id,
    secondary_guest_id: secondary.id,
    household_id: household?.id ?? null,
    confidence: Number(candidate?.confidence ?? 50),
    evidence: (candidate?.evidence as Record<string, unknown> | undefined) ?? {},
    before_state: { candidate },
    after_state: { household, relationship_type: parsed.data.relationship_type },
    reason: parsed.data.reason ?? null,
    decided_by_user_id: user.id,
  }).select().single()

  await audit.record({
    actor: user,
    action: 'crm_guest_household_marked',
    entity_type: 'guest_household',
    entity_id: household?.id ?? null,
    before_state: { candidate },
    after_state: { household, decision_id: decision?.id ?? null },
    reason: parsed.data.reason ?? null,
    description: `Marked ${primary.display_name} and ${secondary.display_name} as household guests`,
    request,
    location_id: primary.location_id ?? secondary.location_id ?? null,
  })

  return NextResponse.json({ data: { household, decision } })
}
