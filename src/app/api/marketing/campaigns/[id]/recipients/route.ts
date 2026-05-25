import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * POST body schema. Each customer_id MUST be a valid UUID — without this
 * check, malformed payloads (mixed types, non-UUID strings) reach the DB
 * upsert and produce confusing 500 errors instead of a clean 400. Cap the
 * batch at 500 so a single request can't enqueue an unbounded number of
 * rows.
 */
const recipientsBodySchema = z.object({
  customer_ids: z.array(z.string().uuid()).min(1).max(500),
})

/**
 * GET /api/marketing/campaigns/:id/recipients — list recipients with tracking status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  // Verify campaign belongs to org.
  const { data: campaign } = await supabase.from('campaigns')
    .select('id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  // Defense-in-depth: even though the campaign id was already verified
  // org-scoped above, also filter recipients by org_id so a misbehaving
  // RLS policy or a future code path using a non-admin client cannot
  // accidentally surface another org's rows.
  let query = supabase.from('campaign_recipients')
    .select('*', { count: 'exact' })
    .eq('campaign_id', id)
    .eq('org_id', user.org_id)
    .order('sent_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0 },
  })
}

/**
 * POST /api/marketing/campaigns/:id/recipients — add recipients to a campaign
 */
export async function POST(
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

  const parsed = recipientsBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    )
  }
  const { customer_ids } = parsed.data

  const supabase = createAdminClient()

  // P0 fix (5.99.6 #5):
  //  1. Verify the campaign belongs to the caller's org BEFORE accepting
  //     any recipients — this route was previously open-bored, allowing
  //     a manager to add recipients to any campaign id they could guess.
  //  2. campaign_recipients has TWO NOT NULL columns the previous insert
  //     omitted: `channel` (baseline.sql:364) and `org_id` (added by
  //     20260504005008_add_campaign_recipients_indexes.sql). Both must
  //     be supplied or the insert fails with 23502.
  //  3. status='pending' was orphan; the rest of the system uses
  //     'queued' for newly-enqueued recipients. Match it for analytics
  //     consistency.
  const { data: campaign, error: campaignErr } = await supabase.from('campaigns')
    .select('id, campaign_type')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (campaignErr || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const channel = (campaign.campaign_type as string) ?? 'email'

  const rows = customer_ids.map((customer_id: string) => ({
    campaign_id: id,
    customer_id,
    org_id: user.org_id,
    channel,
    status: 'queued' as const,
  }))

  const { data, error } = await supabase.from('campaign_recipients')
    .upsert(rows, {
      onConflict: 'campaign_id,customer_id',
      ignoreDuplicates: false,
    })
    .select()

  if (error) {
    return NextResponse.json({ error: 'Failed to add recipients' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
