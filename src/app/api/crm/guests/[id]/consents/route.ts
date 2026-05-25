import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { audit } from '@/lib/audit/log'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { consentPolicyKey, crmConsentWriteRoles, crmGuestReadRoles } from '@/lib/crm/api'
import { upsertGuestConsentSchema } from '@/lib/schemas/crm'
import { createAdminClient } from '@/lib/supabase/admin'

type RouteParams = { params: Promise<{ id: string }> }

const upsertConsentRequestSchema = z.object({
  consents: z.array(upsertGuestConsentSchema).min(1).max(20),
})

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestReadRoles])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()
  const { data: guest } = await supabase
    .from('guests')
    .select('id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('guest_consents')
    .select('*, consent_policy_versions(id, policy_key, version_label, language, effective_at)')
    .eq('guest_id', id)
    .eq('org_id', user.org_id)
    .order('channel', { ascending: true })
    .order('purpose', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch guest consents' }, { status: 500 })

  const { data: suppressions } = await supabase
    .from('suppression_entries')
    .select('*')
    .eq('guest_id', id)
    .eq('org_id', user.org_id)
    .order('suppressed_at', { ascending: false })
    .limit(25)

  return NextResponse.json({ data: data ?? [], suppressions: suppressions ?? [] })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmConsentWriteRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = upsertConsentRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { id } = await params
  const supabase = createAdminClient()
  const { data: guest } = await supabase
    .from('guests')
    .select('id, location_id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  const guestRow = guest as { id: string; location_id: string | null } | null
  if (!guestRow) return NextResponse.json({ error: 'Guest not found' }, { status: 404 })

  const now = new Date().toISOString()
  const { data: before } = await supabase
    .from('guest_consents')
    .select('*')
    .eq('guest_id', id)
    .eq('org_id', user.org_id)

  const rows = parsed.data.consents.map((consent) => ({
    org_id: user.org_id,
    location_id: guestRow.location_id,
    guest_id: id,
    contact_point_id: consent.contact_point_id ?? null,
    policy_version_id: consent.policy_version_id ?? null,
    channel: consent.channel,
    purpose: consent.purpose,
    status: consent.status,
    source: consent.source,
    proof: {
      ...consent.proof,
      policy_key: consentPolicyKey(consent.channel, consent.purpose),
      captured_via: 'guest_360_consent_center',
    },
    captured_by_user_id: user.id,
    captured_at: now,
    revoked_at: consent.status === 'revoked' ? now : null,
    metadata: consent.metadata,
    updated_at: now,
  }))

  const { data, error } = await supabase
    .from('guest_consents')
    .upsert(rows, { onConflict: 'org_id,guest_id,channel,purpose' })
    .select()

  if (error) return NextResponse.json({ error: 'Failed to save guest consent' }, { status: 500 })

  const revokedRows = rows.filter((row) => row.status === 'revoked')
  if (revokedRows.length > 0) {
    await supabase.from('suppression_entries').insert(revokedRows.map((row) => ({
      org_id: user.org_id,
      guest_id: id,
      contact_point_id: row.contact_point_id,
      channel: row.channel,
      purpose: row.purpose,
      reason: 'revoked_consent',
      source: row.source,
      proof: row.proof,
      suppressed_by_user_id: user.id,
      suppressed_at: now,
    })))
  }

  for (const row of rows.filter((consent) => consent.status === 'granted')) {
    await supabase
      .from('suppression_entries')
      .update({ expires_at: now })
      .eq('org_id', user.org_id)
      .eq('guest_id', id)
      .eq('channel', row.channel)
      .eq('purpose', row.purpose)
      .eq('reason', 'revoked_consent')
      .is('expires_at', null)
  }

  await supabase.from('guest_timeline_events').insert({
    org_id: user.org_id,
    location_id: guestRow.location_id,
    guest_id: id,
    actor_user_id: user.id,
    event_type: 'crm.consent.updated',
    event_source: 'crm',
    title: 'Guest consent updated',
    body: 'Consent preferences changed in GuestBrain.',
    visibility: 'manager',
    metadata: { channels: rows.map((row) => `${row.channel}:${row.purpose}:${row.status}`) },
  })

  await audit.record({
    actor: user,
    action: 'crm_guest_consent_updated',
    entity_type: 'guest',
    entity_id: id,
    before_state: { consents: before ?? [] },
    after_state: { consents: data ?? [] },
    description: 'Updated guest consent preferences',
    request,
    location_id: guestRow.location_id,
  })

  return NextResponse.json({ data: data ?? [] })
}
