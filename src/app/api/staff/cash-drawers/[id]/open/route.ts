import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

const openSchema = z.object({
  assigned_to: z.string().uuid(),
  starting_cash: z.string(),
  denominations: z.record(z.string(), z.number().int().min(0)),
})

/**
 * POST /api/staff/cash-drawers/[id]/open — open drawer with starting denomination count
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'server', 'bartender', 'cashier'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = openSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Check drawer exists and is closed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: drawer } = await (supabase.from('cash_drawers') as any)
    .select('id, is_open')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!drawer) {
    return apiError(404, 'Cash drawer not found')
  }

  if (drawer.is_open) {
    return apiError(409, 'Drawer is already open')
  }

  const now = new Date().toISOString()

  // Update drawer status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase.from('cash_drawers') as any)
    .update({
      is_open: true,
      opened_by: parsed.data.assigned_to,
      starting_cash: parsed.data.starting_cash,
      expected_cash: parsed.data.starting_cash,
      opened_at: now,
      closed_at: null,
      actual_cash: '0.00',
      over_short: '0.00',
      updated_at: now,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to open drawer')
  }

  // Record opening count
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('cash_drawer_counts') as any)
      .insert({
        cash_drawer_id: id,
        count_type: 'opening',
        denominations: parsed.data.denominations,
        total: parsed.data.starting_cash,
        counted_by: user.id,
        created_at: now,
      })
  } catch {
    // table may not exist
  }

  // Record event
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('cash_drawer_events') as any)
      .insert({
        cash_drawer_id: id,
        event_type: 'open_shift',
        amount: parseFloat(parsed.data.starting_cash),
        running_total: parseFloat(parsed.data.starting_cash),
        performed_by: user.id,
        description: `Opening count: $${parsed.data.starting_cash}`,
        created_at: now,
      })
  } catch {
    // table may not exist
  }

  return NextResponse.json({ data: updated })
}
