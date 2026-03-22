import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateSwapSchema = z.object({
  status: z.enum(['approved', 'rejected']),
})

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PUT /api/scheduling/swap-requests/:id — approve or reject swap request
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSwapSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get swap request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: swap } = await (supabase.from('shift_swap_requests') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!swap) {
    return NextResponse.json({ error: 'Swap request not found' }, { status: 404 })
  }

  if (swap.status !== 'pending') {
    return NextResponse.json({ error: 'Swap request is not pending' }, { status: 400 })
  }

  // Update swap status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('shift_swap_requests') as any)
    .update({ status: parsed.data.status })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update swap request' }, { status: 500 })
  }

  // If approved and target_user_id exists, update the shift assignment
  if (parsed.data.status === 'approved' && swap.target_user_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('scheduled_shifts') as any)
      .update({ user_id: swap.target_user_id, status: 'swapped' })
      .eq('id', swap.original_shift_id)
      .eq('org_id', user.org_id)
  }

  return NextResponse.json({ data })
}
