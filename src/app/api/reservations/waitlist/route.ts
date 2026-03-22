import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const addToWaitlistSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(20).optional().nullable(),
  party_size: z.number().int().min(1).max(100),
  quoted_wait_minutes: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional().nullable(),
  location_id: z.string().uuid().optional(),
})

/** GET /api/reservations/waitlist — get current waitlist */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const params = request.nextUrl.searchParams
  const status = params.get('status') ?? 'waiting'

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('waitlist_entries') as any)
    .select('*')
    .eq('org_id', user.org_id)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  query = query.order('position', { ascending: true })

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

/** POST /api/reservations/waitlist — add to waitlist */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'host', 'server'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = addToWaitlistSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const locationId = parsed.data.location_id ?? user.location_ids[0]

  if (!locationId) {
    return NextResponse.json({ error: 'No location specified' }, { status: 400 })
  }

  // Get the next position number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lastEntry } = await (supabase.from('waitlist_entries') as any)
    .select('position')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .eq('status', 'waiting')
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const nextPosition = (lastEntry?.position ?? 0) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('waitlist_entries') as any)
    .insert({
      org_id: user.org_id,
      location_id: locationId,
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone ?? null,
      party_size: parsed.data.party_size,
      quoted_wait_minutes: parsed.data.quoted_wait_minutes ?? null,
      position: nextPosition,
      status: 'waiting',
      notes: parsed.data.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to add to waitlist' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
