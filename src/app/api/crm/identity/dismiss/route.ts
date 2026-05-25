import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestManagerRoles } from '@/lib/crm/api'
import { resolveGuestCandidateSchema } from '@/lib/schemas/crm'

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestManagerRoles])
  if (roleErr) return roleErr

  const body = await request.json().catch(() => null)
  const parsed = resolveGuestCandidateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: candidate } = await supabase
    .from('guest_merge_candidates')
    .select('*')
    .eq('id', parsed.data.candidate_id)
    .eq('org_id', user.org_id)
    .eq('status', 'pending')
    .single()

  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  const status = parsed.data.decision_type === 'dismiss' ? 'dismissed' : 'kept_separate'
  await supabase
    .from('guest_merge_candidates')
    .update({ status, reviewed_by_user_id: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', candidate.id)
    .eq('org_id', user.org_id)

  const { data: decision } = await supabase.from('guest_merge_decisions').insert({
    org_id: user.org_id,
    location_id: candidate.location_id ?? null,
    candidate_id: candidate.id,
    decision_type: parsed.data.decision_type,
    primary_guest_id: candidate.primary_guest_id,
    secondary_guest_id: candidate.candidate_guest_id,
    confidence: candidate.confidence,
    evidence: candidate.evidence ?? {},
    before_state: candidate as Record<string, unknown>,
    after_state: { status },
    reason: parsed.data.reason ?? null,
    decided_by_user_id: user.id,
  }).select().single()

  await audit.record({
    actor: user,
    action: parsed.data.decision_type === 'dismiss' ? 'crm_guest_merge_dismissed' : 'crm_guest_kept_separate',
    entity_type: 'guest_merge_candidate',
    entity_id: candidate.id,
    before_state: candidate as Record<string, unknown>,
    after_state: { status, decision_id: decision?.id ?? null },
    reason: parsed.data.reason ?? null,
    description: parsed.data.decision_type === 'dismiss' ? 'Dismissed CRM guest merge candidate' : 'Marked CRM guests as separate profiles',
    request,
    location_id: candidate.location_id ?? null,
  })

  return NextResponse.json({ data: decision })
}
