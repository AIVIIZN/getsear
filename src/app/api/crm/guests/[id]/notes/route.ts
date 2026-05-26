import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { canWriteGuestVisibility, crmGuestWriteRoles } from '@/lib/crm/api'
import { createGuestNoteSchema } from '@/lib/schemas/crm'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestWriteRoles])
  if (roleErr) return roleErr

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createGuestNoteSchema.safeParse({ ...(body as Record<string, unknown>), guest_id: id })
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  if (parsed.data.note_category === 'sensitive' && parsed.data.visibility === 'service') {
    return apiError(400, 'Sensitive notes must be manager or owner visible')
  }
  if (!canWriteGuestVisibility(user, parsed.data.visibility)) {
    return apiError(403, 'Forbidden: insufficient note visibility permissions')
  }

  const supabase = createAdminClient()
  const { data: guest } = await supabase
    .from('guests')
    .select('id, display_name, location_id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (!guest) {
    return apiError(404, 'Guest not found')
  }

  const { data: note, error } = await supabase
    .from('guest_notes')
    .insert({
      ...parsed.data,
      org_id: user.org_id,
      location_id: parsed.data.location_id ?? guest.location_id ?? null,
      author_user_id: user.id,
    })
    .select()
    .single()

  if (error || !note) {
    return apiError(500, 'Failed to add guest note')
  }

  await supabase.from('guest_timeline_events').insert({
    org_id: user.org_id,
    location_id: note.location_id ?? null,
    guest_id: id,
    actor_user_id: user.id,
    event_type: 'crm.guest.note_added',
    event_source: 'crm',
    title: 'Guest note added',
    body: parsed.data.note_category === 'sensitive' ? null : parsed.data.body,
    visibility: parsed.data.visibility,
    metadata: { note_id: note.id, note_category: parsed.data.note_category, pinned: parsed.data.pinned },
  })

  await audit.record({
    actor: user,
    action: 'crm_guest_note_added',
    entity_type: 'guest_note',
    entity_id: note.id,
    after_state: note as Record<string, unknown>,
    description: `Added ${parsed.data.visibility} CRM note for ${guest.display_name}`,
    request,
    location_id: note.location_id ?? null,
  })

  return NextResponse.json({ data: note }, { status: 201 })
}
