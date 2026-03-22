import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const assignSchema = z.object({
  driver_id: z.string().uuid(),
})

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/delivery/deliveries/:id/assign — assign driver to delivery
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify delivery exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: delivery } = await (supabase.from('deliveries') as any)
    .select('id, status')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!delivery) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
  }

  if (delivery.status !== 'pending') {
    return NextResponse.json({ error: 'Delivery is not in a pending state' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('deliveries') as any)
    .update({
      driver_id: parsed.data.driver_id,
      status: 'assigned',
    })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to assign driver' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
