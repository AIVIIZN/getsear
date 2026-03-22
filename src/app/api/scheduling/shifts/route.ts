import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createShiftSchema = z.object({
  location_id: z.string().uuid().optional().nullable(),
  user_id: z.string().uuid(),
  template_id: z.string().uuid().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  role: z.string().max(50).optional().nullable(),
  status: z.enum(['draft', 'published', 'confirmed', 'swapped']).default('draft'),
  notes: z.string().max(500).optional().nullable(),
})

/**
 * GET /api/scheduling/shifts — list shifts (filterable)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const status = searchParams.get('status')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('scheduled_shifts') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (userId) {
    query = query.eq('user_id', userId)
  }

  if (dateFrom) {
    query = query.gte('shift_date', dateFrom)
  }

  if (dateTo) {
    query = query.lte('shift_date', dateTo)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/scheduling/shifts — create shift
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

  const parsed = createShiftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('scheduled_shifts') as any)
    .insert({
      org_id: user.org_id,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
