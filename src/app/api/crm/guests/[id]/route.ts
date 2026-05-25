import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import {
  buildGuestDisplayName,
  crmGuestReadRoles,
  crmGuestWriteRoles,
  hashGuestContactValue,
  normalizeGuestContactValue,
  noteVisibilityFilter,
} from '@/lib/crm/api'
import { createGuestContactPointSchema, updateGuestSchema } from '@/lib/schemas/crm'

type RouteParams = { params: Promise<{ id: string }> }

const updateGuestRequestSchema = updateGuestSchema.extend({
  contact_points: z.array(createGuestContactPointSchema.omit({ guest_id: true, value_hash: true }).extend({
    id: z.string().uuid().optional(),
    is_primary: z.boolean().optional(),
  })).optional(),
})

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestReadRoles])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()
  const { data: guest, error } = await supabase
    .from('guests')
    .select('*, guest_contact_points(id, contact_type, label, value, normalized_value, is_primary, is_verified, source), guest_preferences(*), guest_allergies(*), guest_consents(*, consent_policy_versions(id, policy_key, version_label, language, effective_at)), suppression_entries(*), guest_tags(id, tag_id, crm_tags(id, name, slug, tag_category, color_token, is_sensitive))')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !guest) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
  }

  const { data: notes } = await supabase
    .from('guest_notes')
    .select('*')
    .eq('guest_id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .or(noteVisibilityFilter(user))
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(25)

  return NextResponse.json({ data: { ...guest, notes: notes ?? [] } })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestWriteRoles])
  if (roleErr) return roleErr

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateGuestRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { contact_points, ...guestPatch } = parsed.data
  const { data: before } = await supabase
    .from('guests')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (!before) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
  }

  const patch = {
    ...guestPatch,
    display_name: buildGuestDisplayName({ ...before, ...guestPatch }),
    updated_at: new Date().toISOString(),
  }

  const { data: guest, error } = await supabase
    .from('guests')
    .update(patch)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error || !guest) {
    return NextResponse.json({ error: 'Failed to update guest' }, { status: 500 })
  }

  if (contact_points) {
    for (const contact of contact_points) {
      const normalized = normalizeGuestContactValue(contact)
      const row = {
        contact_type: contact.contact_type,
        label: contact.label ?? null,
        value: contact.value,
        normalized_value: contact.normalized_value ?? normalized,
        value_hash: hashGuestContactValue(normalized),
        is_primary: contact.is_primary ?? false,
        is_verified: contact.is_verified ?? false,
        verification_source: contact.verification_source ?? null,
        source: contact.source,
        metadata: contact.metadata,
        location_id: contact.location_id ?? guest.location_id ?? null,
        updated_at: new Date().toISOString(),
      }

      const contactResult = contact.id
        ? await supabase
          .from('guest_contact_points')
          .update(row)
          .eq('id', contact.id)
          .eq('guest_id', id)
          .eq('org_id', user.org_id)
          .is('deleted_at', null)
        : await supabase
          .from('guest_contact_points')
          .insert({
            ...row,
            org_id: user.org_id,
            guest_id: id,
          })

      if (contactResult.error) {
        return NextResponse.json({ error: 'Guest updated but contact point update failed' }, { status: 409 })
      }
    }
  }

  await supabase.from('guest_timeline_events').insert({
    org_id: user.org_id,
    location_id: guest.location_id ?? null,
    guest_id: id,
    actor_user_id: user.id,
    event_type: 'crm.guest.updated',
    event_source: 'crm',
    title: 'Guest profile updated',
    body: `${guest.display_name} profile details changed.`,
    visibility: 'service',
    metadata: { changed_fields: Object.keys(guestPatch), contact_points_changed: contact_points?.length ?? 0 },
  })

  await audit.record({
    actor: user,
    action: 'crm_guest_updated',
    entity_type: 'guest',
    entity_id: id,
    before_state: before as Record<string, unknown>,
    after_state: guest as Record<string, unknown>,
    description: `Updated CRM guest ${guest.display_name}`,
    request,
    location_id: guest.location_id ?? null,
  })

  return NextResponse.json({ data: guest })
}
