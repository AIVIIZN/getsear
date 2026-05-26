import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

const seatSchema = z.object({
  guest_count: z.number().int().min(1).max(50),
  server_id: z.string().uuid().optional(),
})

/**
 * POST /api/tables/[id]/seat — seat guests at table
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = seatSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Verify table exists and is available or reserved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: table } = await (supabase.from('tables') as any)
    .select('id, status, is_active')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!table) {
    return apiError(404, 'Table not found')
  }

  if (!table.is_active) {
    return apiError(400, 'Table is inactive')
  }

  if (!['available', 'reserved', 'dirty'].includes(table.status)) {
    return apiError(400, `Cannot seat at table with status "${table.status}"`)
  }

  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('tables') as any)
    .update({
      status: 'seated',
      guest_count: parsed.data.guest_count,
      current_server_id: parsed.data.server_id ?? null,
      seated_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select('*')
    .single()

  if (error) {
    return apiError(500, 'Failed to seat table')
  }

  return NextResponse.json({ data })
}
