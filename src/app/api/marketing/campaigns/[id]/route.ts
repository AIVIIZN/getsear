import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * Campaign update schema. Accepts both legacy UI aliases and canonical
 * DB column names (see POST route). Mirrors the same alias normalization
 * before hitting the DB so we never insert/update phantom columns.
 */
const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['email', 'sms', 'push']).optional(),
  campaign_type: z.enum(['email', 'sms', 'push']).optional(),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'cancelled']).optional(),
  subject: z.string().max(500).optional().nullable(),
  body: z.string().max(50000).optional().nullable(),
  body_html: z.string().max(50000).optional().nullable(),
  sms_body: z.string().max(2000).optional().nullable(),
  segment_criteria: z.record(z.string(), z.unknown()).optional().nullable(),
  target_segment: z.record(z.string(), z.unknown()).optional().nullable(),
  scheduled_at: z.string().datetime().optional().nullable(),
  scheduled_for: z.string().datetime().optional().nullable(),
})

/**
 * GET /api/marketing/campaigns/:id — get single campaign with stats
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('campaigns') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  return NextResponse.json({ data })
}

/**
 * PUT /api/marketing/campaigns/:id — update campaign
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateCampaignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // Build a patch using ONLY canonical DB column names. This avoids
  // sending phantom columns (`type`, `body`, `segment_criteria`,
  // `scheduled_at`) that would otherwise cause the update to fail.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) patch.name = parsed.data.name
  if (parsed.data.status !== undefined) patch.status = parsed.data.status
  if (parsed.data.subject !== undefined) patch.subject = parsed.data.subject
  if (parsed.data.sms_body !== undefined) patch.sms_body = parsed.data.sms_body
  // Aliased fields — accept either name on the way in.
  const campaignType = parsed.data.campaign_type ?? parsed.data.type
  if (campaignType !== undefined) patch.campaign_type = campaignType
  const bodyHtml = parsed.data.body_html ?? parsed.data.body
  if (bodyHtml !== undefined) patch.body_html = bodyHtml
  const targetSegment = parsed.data.target_segment ?? parsed.data.segment_criteria
  if (targetSegment !== undefined) patch.target_segment = targetSegment
  const scheduledFor = parsed.data.scheduled_for ?? parsed.data.scheduled_at
  if (scheduledFor !== undefined) patch.scheduled_for = scheduledFor

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('campaigns') as any)
    .update(patch)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/marketing/campaigns/:id — delete draft campaign
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // Only allow deleting draft campaigns
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('campaigns') as any)
    .select('status')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (existing.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft campaigns can be deleted' },
      { status: 400 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('campaigns') as any)
    .delete()
    .eq('id', id)
    .eq('org_id', user.org_id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
