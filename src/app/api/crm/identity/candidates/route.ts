import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { crmGuestManagerRoles } from '@/lib/crm/api'
import { buildIdentityCandidates, type IdentityGuest } from '@/lib/crm/identity'
import { listGuestMergeCandidatesQuerySchema } from '@/lib/schemas/crm'

type CandidateRow = {
  id: string
  primary_guest_id: string
  candidate_guest_id: string
  confidence: number
  confidence_level: string
  signals: string[]
  evidence: unknown
  status: string
  created_at: string
  primary_guest?: { id: string; display_name: string; lifecycle_stage: string; total_visits: number; total_spend: string | number } | null
  candidate_guest?: { id: string; display_name: string; lifecycle_stage: string; total_visits: number; total_spend: string | number } | null
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestManagerRoles])
  if (roleErr) return roleErr

  const parsed = listGuestMergeCandidatesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { guest_id, status, generate, limit } = parsed.data
  const supabase = createAdminClient()

  if (generate && status === 'pending') {
    const { data: guests } = await supabase
      .from('guests')
      .select('id, display_name, first_name, last_name, location_id, lifecycle_stage, total_visits, total_spend, guest_contact_points(contact_type, value, normalized_value, value_hash, is_verified), guest_identifiers(identifier_type, provider, display_value, value_hash, is_primary)')
      .eq('org_id', user.org_id)
      .eq('profile_status', 'active')
      .is('deleted_at', null)
      .limit(200)

    const candidates = buildIdentityCandidates((guests ?? []) as IdentityGuest[]).slice(0, 50)
    for (const candidate of candidates) {
      if (guest_id && ![candidate.primary_guest_id, candidate.candidate_guest_id].includes(guest_id)) continue
      const { data: existing } = await supabase
        .from('guest_merge_candidates')
        .select('id')
        .eq('org_id', user.org_id)
        .eq('status', 'pending')
        .or(`and(primary_guest_id.eq.${candidate.primary_guest_id},candidate_guest_id.eq.${candidate.candidate_guest_id}),and(primary_guest_id.eq.${candidate.candidate_guest_id},candidate_guest_id.eq.${candidate.primary_guest_id})`)
        .maybeSingle()

      const row = {
        org_id: user.org_id,
        primary_guest_id: candidate.primary_guest_id,
        candidate_guest_id: candidate.candidate_guest_id,
        confidence: candidate.confidence,
        confidence_level: candidate.confidence_level,
        signals: candidate.signals,
        evidence: { items: candidate.evidence },
        status: 'pending',
        updated_at: new Date().toISOString(),
      }

      if (existing?.id) {
        await supabase
          .from('guest_merge_candidates')
          .update(row)
          .eq('id', existing.id)
          .eq('org_id', user.org_id)
      } else {
        await supabase
          .from('guest_merge_candidates')
          .insert(row)
      }
    }
  }

  let query = supabase
    .from('guest_merge_candidates')
    .select('id, primary_guest_id, candidate_guest_id, confidence, confidence_level, signals, evidence, status, created_at')
    .eq('org_id', user.org_id)
    .eq('status', status)
    .order('confidence', { ascending: false })
    .limit(limit)

  if (guest_id) {
    query = query.or(`primary_guest_id.eq.${guest_id},candidate_guest_id.eq.${guest_id}`)
  }

  const { data, error } = await query
  if (error) {
    return apiError(500, 'Failed to load identity candidates')
  }

  const rows = (data ?? []) as CandidateRow[]
  const guestIds = Array.from(new Set(rows.flatMap((row) => [row.primary_guest_id, row.candidate_guest_id])))
  const { data: guestRows } = guestIds.length
    ? await supabase
      .from('guests')
      .select('id, display_name, lifecycle_stage, total_visits, total_spend')
      .eq('org_id', user.org_id)
      .in('id', guestIds)
    : { data: [] }
  const guestsById = new Map((guestRows ?? []).map((guest) => [(guest as { id: string }).id, guest]))

  return NextResponse.json({
    data: rows.map((row) => ({
      ...row,
      primary_guest: guestsById.get(row.primary_guest_id) ?? null,
      candidate_guest: guestsById.get(row.candidate_guest_id) ?? null,
    })),
  })
}
