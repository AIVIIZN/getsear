import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * Campaign create schema. Accepts both legacy UI field names
 * (type/body/segment_criteria/scheduled_at) and the canonical DB column
 * names (campaign_type/body_html/target_segment/scheduled_for) so the
 * marketing UI does not need a synchronous schema flip. The route
 * normalizes to the DB shape before insert.
 *
 * P0 fix (5.99.6 #1): the previous version inserted non-existent columns
 * `type`, `body`, `segment_criteria`, `scheduled_at`, `stats` and omitted
 * the NOT NULL `target_segment` and `created_by` columns; every create
 * failed at the DB layer.
 */
const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['email', 'sms', 'push']).optional(),
  campaign_type: z.enum(['email', 'sms', 'push']).optional(),
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
 * GET /api/marketing/campaigns — list campaigns with filters
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const params = request.nextUrl.searchParams
  const status = params.get('status')
  const type = params.get('type')
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('campaigns') as any)
    .select('*', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('campaign_type', type)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0 },
  })
}

/**
 * POST /api/marketing/campaigns — create a new campaign
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createCampaignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // Normalize legacy UI field names → DB column names. Either alias is
  // acceptable from the client; the DB only has the canonical name.
  const campaignType = parsed.data.campaign_type ?? parsed.data.type
  if (!campaignType) {
    return NextResponse.json(
      { error: 'campaign_type is required' },
      { status: 400 },
    )
  }
  const bodyHtml = parsed.data.body_html ?? parsed.data.body ?? null
  const targetSegment = parsed.data.target_segment ?? parsed.data.segment_criteria ?? {}
  const scheduledFor = parsed.data.scheduled_for ?? parsed.data.scheduled_at ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('campaigns') as any)
    .insert({
      org_id: user.org_id,
      name: parsed.data.name,
      campaign_type: campaignType,
      status: 'draft',
      subject: parsed.data.subject ?? null,
      body_html: bodyHtml,
      sms_body: parsed.data.sms_body ?? null,
      // target_segment is NOT NULL — default to empty object when client
      // hasn't supplied a segment yet (e.g. drafts).
      target_segment: targetSegment,
      scheduled_for: scheduledFor,
      // created_by is NOT NULL.
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
