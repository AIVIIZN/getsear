import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateEventSchema = z.object({
  event_name: z.string().min(1).max(300).optional(),
  event_date: z.string().optional(),
  event_time: z.string().optional(),
  guest_count: z.number().int().min(1).max(10000).optional(),
  status: z.enum(['inquiry', 'quoted', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
  total: z.string().optional().nullable(),
  deposit: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  contact_name: z.string().max(200).optional(),
  contact_phone: z.string().max(30).optional().nullable(),
  contact_email: z.string().email().optional().nullable(),
  delivery_address: z.record(z.string(), z.unknown()).optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
})

/**
 * GET /api/catering/events/:id — get single catering event
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('catering_events') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !data) {
    return apiError(404, 'Event not found')
  }

  return NextResponse.json({ data })
}

/**
 * PUT /api/catering/events/:id — update catering event
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateEventSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('catering_events') as any)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return apiError(500, 'Failed to update event')
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/catering/events/:id — cancel catering event (manager+)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('catering_events') as any)
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return apiError(500, 'Failed to cancel event')
  }

  return NextResponse.json({ data })
}
