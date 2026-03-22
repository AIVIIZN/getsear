import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const fireCourseSchema = z.object({
  course: z.number().int().min(1).max(20),
})

/**
 * POST /api/orders/[id]/fire-course — fire a specific course number
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: orderId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = fireCourseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'course number is required', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Verify order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id, org_id')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Fire all items for the specified course
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: firedItems, error } = await (supabase.from('order_items') as any)
    .update({ is_fired: true, fired_at: now })
    .eq('order_id', orderId)
    .eq('course', parsed.data.course)
    .eq('is_voided', false)
    .eq('is_fired', false)
    .select()

  if (error) {
    return NextResponse.json({ error: 'Failed to fire course' }, { status: 500 })
  }

  // Update order status to fired if not already
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('orders') as any)
    .update({ status: 'fired', updated_at: now })
    .eq('id', orderId)
    .in('status', ['open', 'draft'])

  return NextResponse.json({
    data: { course: parsed.data.course, items_fired: firedItems?.length ?? 0 },
  })
}
