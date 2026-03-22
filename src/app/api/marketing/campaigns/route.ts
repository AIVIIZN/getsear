import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['email', 'sms', 'push']),
  subject: z.string().max(500).optional().nullable(),
  body: z.string().max(50000).optional().nullable(),
  segment_criteria: z.record(z.string(), z.unknown()).optional().nullable(),
  scheduled_at: z.string().datetime().optional().nullable(),
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
  if (type) query = query.eq('type', type)

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('campaigns') as any)
    .insert({
      org_id: user.org_id,
      name: parsed.data.name,
      type: parsed.data.type,
      status: 'draft',
      subject: parsed.data.subject ?? null,
      body: parsed.data.body ?? null,
      segment_criteria: parsed.data.segment_criteria ?? null,
      scheduled_at: parsed.data.scheduled_at ?? null,
      stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
