import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const createSwapSchema = z.object({
  original_shift_id: z.string().uuid(),
  target_user_id: z.string().uuid().optional().nullable(),
})

/**
 * GET /api/scheduling/swap-requests — list swap requests
 */
export async function GET(_request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('shift_swap_requests') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })

  if (error) {
    return apiError(500, 'Failed to fetch swap requests')
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/scheduling/swap-requests — create swap request
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createSwapSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Verify the shift belongs to the requesting user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shift } = await (supabase.from('scheduled_shifts') as any)
    .select('id, user_id')
    .eq('id', parsed.data.original_shift_id)
    .eq('org_id', user.org_id)
    .single()

  if (!shift) {
    return apiError(404, 'Shift not found')
  }

  if (shift.user_id !== user.id) {
    return apiError(403, 'You can only request swaps for your own shifts')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('shift_swap_requests') as any)
    .insert({
      org_id: user.org_id,
      original_shift_id: parsed.data.original_shift_id,
      requesting_user_id: user.id,
      target_user_id: parsed.data.target_user_id ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to create swap request')
  }

  return NextResponse.json({ data }, { status: 201 })
}
