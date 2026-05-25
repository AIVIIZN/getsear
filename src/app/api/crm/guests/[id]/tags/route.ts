import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestWriteRoles } from '@/lib/crm/api'
import { createGuestTagSchema } from '@/lib/schemas/crm'

type RouteParams = { params: Promise<{ id: string }> }

const tagRequestSchema = createGuestTagSchema.omit({ guest_id: true, tag_id: true }).extend({
  tag_id: z.string().uuid().optional(),
  tag_slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  tag_name: z.string().trim().min(1).max(120).optional(),
}).refine((data) => data.tag_id || (data.tag_slug && data.tag_name), {
  message: 'Provide tag_id or both tag_slug and tag_name',
})

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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = tagRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
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
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
  }

  let tagId = parsed.data.tag_id ?? null
  if (!tagId) {
    const { data: existingTag } = await supabase
      .from('crm_tags')
      .select('id')
      .eq('org_id', user.org_id)
      .eq('slug', parsed.data.tag_slug)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingTag?.id) {
      tagId = existingTag.id
    } else {
      const { data: tag, error: tagError } = await supabase
        .from('crm_tags')
        .insert({
          org_id: user.org_id,
          location_id: parsed.data.location_id ?? guest.location_id ?? null,
          name: parsed.data.tag_name,
          slug: parsed.data.tag_slug,
          tag_category: 'custom',
          is_system: false,
          is_sensitive: false,
          metadata: {},
        })
        .select('id')
        .single()

      if (tagError || !tag) {
        return NextResponse.json({ error: 'Failed to create CRM tag' }, { status: 500 })
      }
      tagId = tag.id
    }
  }

  const assignmentInput: Omit<typeof parsed.data, 'tag_id' | 'tag_slug' | 'tag_name'> = {
    location_id: parsed.data.location_id,
    assignment_source: parsed.data.assignment_source,
    assignment_reason: parsed.data.assignment_reason,
    confidence: parsed.data.confidence,
    metadata: parsed.data.metadata,
  }
  const { data: assignment, error } = await supabase
    .from('guest_tags')
    .insert({
      ...assignmentInput,
      org_id: user.org_id,
      location_id: assignmentInput.location_id ?? guest.location_id ?? null,
      guest_id: id,
      tag_id: tagId,
    })
    .select('*, crm_tags(id, name, slug, tag_category, color_token, is_sensitive)')
    .single()

  if (error || !assignment) {
    return NextResponse.json({ error: 'Failed to tag guest' }, { status: 409 })
  }

  await supabase.from('guest_timeline_events').insert({
    org_id: user.org_id,
    location_id: assignment.location_id ?? null,
    guest_id: id,
    actor_user_id: user.id,
    event_type: 'crm.guest.tagged',
    event_source: 'crm',
    title: 'Guest tag added',
    body: `${guest.display_name} was tagged.`,
    visibility: 'service',
    metadata: { tag_id: tagId, assignment_id: assignment.id, assignment_source: assignment.assignment_source },
  })

  await audit.record({
    actor: user,
    action: 'crm_guest_tagged',
    entity_type: 'guest_tag',
    entity_id: assignment.id,
    after_state: assignment as Record<string, unknown>,
    description: `Tagged CRM guest ${guest.display_name}`,
    request,
    location_id: assignment.location_id ?? null,
  })

  return NextResponse.json({ data: assignment }, { status: 201 })
}
