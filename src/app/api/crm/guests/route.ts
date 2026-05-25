import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import {
  buildGuestDisplayName,
  crmGuestReadRoles,
  crmGuestWriteRoles,
  escapePostgrestLikePattern,
  getCrmGuestPermissions,
  hashGuestContactValue,
  normalizeGuestContactValue,
  sanitizeGuestForCrmRole,
} from '@/lib/crm/api'
import {
  createGuestContactPointSchema,
  createGuestSchema,
  listGuestsQuerySchema,
} from '@/lib/schemas/crm'

const createGuestRequestSchema = createGuestSchema.extend({
  contact_points: z.array(createGuestContactPointSchema.omit({ guest_id: true, value_hash: true }).extend({
    is_primary: z.boolean().optional(),
  })).default([]),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestReadRoles])
  if (roleErr) return roleErr

  const parsed = listGuestsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { page, limit, sort_by, sort_dir, search, preference, tag_id, lifecycle_stage, birthday, location_id, last_visit_after, last_visit_before } = parsed.data
  const sortBy = sort_by === 'total_spend' && !getCrmGuestPermissions(user).can_view_revenue_attribution ? 'last_visit_at' : sort_by
  const offset = (page - 1) * limit
  const supabase = createAdminClient()
  let guestIdsFromSignals: string[] | null = null

  if (search?.trim()) {
    const normalizedEmail = normalizeGuestContactValue({ contact_type: 'email', value: search })
    const normalizedPhone = normalizeGuestContactValue({ contact_type: 'phone', value: search })
    const hashes = Array.from(new Set([
      hashGuestContactValue(normalizedEmail),
      hashGuestContactValue(normalizedPhone),
    ]))

    const { data: contactMatches } = await supabase
      .from('guest_contact_points')
      .select('guest_id')
      .eq('org_id', user.org_id)
      .is('deleted_at', null)
      .in('value_hash', hashes)

    guestIdsFromSignals = Array.from(new Set((contactMatches ?? []).map((row: { guest_id: string }) => row.guest_id)))

    const safeSearch = escapePostgrestLikePattern(search.trim())
    const { data: nameMatches } = await supabase
      .from('guests')
      .select('id')
      .eq('org_id', user.org_id)
      .is('deleted_at', null)
      .ilike('display_name', `%${safeSearch}%`)

    guestIdsFromSignals = Array.from(new Set([
      ...guestIdsFromSignals,
      ...(nameMatches ?? []).map((row: { id: string }) => row.id),
    ]))
  }

  if (tag_id) {
    const { data: tagged } = await supabase
      .from('guest_tags')
      .select('guest_id')
      .eq('org_id', user.org_id)
      .eq('tag_id', tag_id)
      .is('deleted_at', null)

    const tagGuestIds = Array.from(new Set((tagged ?? []).map((row: { guest_id: string }) => row.guest_id)))
    guestIdsFromSignals = guestIdsFromSignals === null
      ? tagGuestIds
      : guestIdsFromSignals.filter((id) => tagGuestIds.includes(id))
  }

  if (preference?.trim()) {
    const safePreference = escapePostgrestLikePattern(preference.trim())
    const { data: preferenceMatches } = await supabase
      .from('guest_preferences')
      .select('guest_id')
      .eq('org_id', user.org_id)
      .is('deleted_at', null)
      .ilike('preference_key', `%${safePreference}%`)

    const preferenceGuestIds = Array.from(new Set((preferenceMatches ?? []).map((row: { guest_id: string }) => row.guest_id)))
    guestIdsFromSignals = guestIdsFromSignals === null
      ? preferenceGuestIds
      : guestIdsFromSignals.filter((id) => preferenceGuestIds.includes(id))
  }

  let query = supabase
    .from('guests')
    .select('*, guest_contact_points(id, contact_type, label, value, normalized_value, is_primary, is_verified, source), guest_tags(id, tag_id, crm_tags(id, name, slug, tag_category, color_token, is_sensitive))', { count: 'exact' })
    .eq('org_id', user.org_id)
    .is('deleted_at', null)

  if (guestIdsFromSignals !== null) {
    if (guestIdsFromSignals.length === 0) {
      return NextResponse.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } })
    }
    query = query.in('id', guestIdsFromSignals)
  }

  if (lifecycle_stage) query = query.eq('lifecycle_stage', lifecycle_stage)
  if (birthday) query = query.eq('birthday', birthday)
  if (location_id) query = query.eq('location_id', location_id)
  if (last_visit_after) query = query.gte('last_visit_at', last_visit_after)
  if (last_visit_before) query = query.lte('last_visit_at', last_visit_before)

  const { data, error, count } = await query
    .order(sortBy, { ascending: sort_dir === 'asc' })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch guests' }, { status: 500 })
  }

  return NextResponse.json({
    data: (data ?? []).map((guest) => sanitizeGuestForCrmRole(guest as Record<string, unknown>, user)),
    pagination: {
      page,
      limit,
      total: count ?? 0,
      total_pages: Math.ceil((count ?? 0) / limit),
    },
  })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestWriteRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createGuestRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { contact_points, ...guestInput } = parsed.data
  const supabase = createAdminClient()
  const displayName = buildGuestDisplayName(guestInput)

  const { data: guest, error } = await supabase
    .from('guests')
    .insert({
      ...guestInput,
      display_name: displayName,
      org_id: user.org_id,
    })
    .select()
    .single()

  if (error || !guest) {
    return NextResponse.json({ error: 'Failed to create guest' }, { status: 500 })
  }

  if (contact_points.length > 0) {
    const rows = contact_points.map((contact) => {
      const normalized = normalizeGuestContactValue(contact)
      return {
        ...contact,
        org_id: user.org_id,
        location_id: contact.location_id ?? guest.location_id ?? null,
        guest_id: guest.id,
        normalized_value: contact.normalized_value ?? normalized,
        value_hash: hashGuestContactValue(normalized),
        is_primary: contact.is_primary ?? false,
      }
    })
    const { error: contactError } = await supabase.from('guest_contact_points').insert(rows)
    if (contactError) {
      return NextResponse.json({ error: 'Guest created but contact point insert failed' }, { status: 409 })
    }
  }

  await supabase.from('guest_timeline_events').insert({
    org_id: user.org_id,
    location_id: guest.location_id ?? null,
    guest_id: guest.id,
    actor_user_id: user.id,
    event_type: 'crm.guest.created',
    event_source: 'crm',
    title: 'Guest profile created',
    body: `${displayName} was added to GuestBrain CRM.`,
    visibility: 'service',
    metadata: { contact_point_count: contact_points.length },
  })

  await audit.record({
    actor: user,
    action: 'crm_guest_created',
    entity_type: 'guest',
    entity_id: guest.id,
    after_state: guest as Record<string, unknown>,
    description: `Created CRM guest ${displayName}`,
    request,
    location_id: guest.location_id ?? null,
  })

  return NextResponse.json({ data: guest }, { status: 201 })
}
