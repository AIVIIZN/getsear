import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const upsertAvailabilitySchema = z.object({
  entries: z.array(
    z.object({
      day_of_week: z.number().min(0).max(6),
      start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      is_available: z.boolean(),
    })
  ),
})

/**
 * GET /api/scheduling/availability — get all availability (managers see all, staff see own)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('staff_availability') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error) {
    return apiError(500, 'Failed to fetch availability')
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * PUT /api/scheduling/availability — update own availability (bulk upsert)
 */
export async function PUT(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = upsertAvailabilitySchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Delete existing availability for this user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('staff_availability') as any)
    .delete()
    .eq('org_id', user.org_id)
    .eq('user_id', user.id)

  // Insert new entries
  const rows = parsed.data.entries.map((entry) => ({
    org_id: user.org_id,
    user_id: user.id,
    ...entry,
  }))

  if (rows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('staff_availability') as any)
      .insert(rows)

    if (error) {
      return apiError(500, 'Failed to update availability')
    }
  }

  return NextResponse.json({ success: true })
}
