import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/delivery/deliveries/:id — get delivery detail
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await context.params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('deliveries') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !data) {
    return apiError(404, 'Delivery not found')
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/delivery/deliveries/:id — cancel delivery
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await context.params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: delivery } = await (supabase.from('deliveries') as any)
    .select('id, status')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!delivery) {
    return apiError(404, 'Delivery not found')
  }

  if (delivery.status === 'delivered' || delivery.status === 'cancelled') {
    return apiError(400, 'Cannot cancel this delivery')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('deliveries') as any)
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return apiError(500, 'Failed to cancel delivery')
  }

  return NextResponse.json({ data })
}
