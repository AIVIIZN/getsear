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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = seatSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
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
    return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  }

  if (!table.is_active) {
    return NextResponse.json({ error: 'Table is inactive' }, { status: 400 })
  }

  if (!['available', 'reserved', 'dirty'].includes(table.status)) {
    return NextResponse.json(
      { error: `Cannot seat at table with status "${table.status}"` },
      { status: 400 }
    )
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
    return NextResponse.json({ error: 'Failed to seat table' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
