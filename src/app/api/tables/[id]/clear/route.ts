import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

const clearSchema = z.object({
  mark_available: z.boolean().default(false),
})

/**
 * POST /api/tables/[id]/clear — clear table (status -> dirty or available)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = clearSchema.safeParse(body)
  const markAvailable = parsed.success ? parsed.data.mark_available : false

  const supabase = createAdminClient()

  // Verify table exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: table } = await (supabase.from('tables') as any)
    .select('id, status, is_active, current_order_id, seated_at, current_server_id, guest_count')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const newStatus = markAvailable ? 'available' : (table.status === 'dirty' ? 'available' : 'dirty')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('tables') as any)
    .update({
      status: newStatus,
      current_order_id: null,
      current_server_id: null,
      guest_count: 0,
      seated_at: null,
      updated_at: now,
    })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to clear table' }, { status: 500 })
  }

  // Create table_history record if the table was occupied
  if (table.seated_at && table.status !== 'available' && table.status !== 'dirty') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('table_history') as any)
      .insert({
        org_id: user.org_id,
        table_id: id,
        order_id: table.current_order_id,
        server_id: table.current_server_id,
        seated_at: table.seated_at,
        cleared_at: now,
        guest_count: table.guest_count ?? 0,
      })
      .select('id')
  }

  return NextResponse.json({ data })
}
