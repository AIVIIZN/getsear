import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const statusSchema = z.object({
  status: z.enum(['pending', 'assigned', 'picked_up', 'en_route', 'delivered', 'cancelled']),
})

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/delivery/deliveries/:id/status — update delivery status
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Build update payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {
    status: parsed.data.status,
  }

  if (parsed.data.status === 'picked_up') {
    updatePayload.pickup_at = new Date().toISOString()
  } else if (parsed.data.status === 'delivered') {
    updatePayload.delivered_at = new Date().toISOString()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('deliveries') as any)
    .update(updatePayload)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return apiError(500, 'Failed to update delivery status')
  }

  return NextResponse.json({ data })
}
