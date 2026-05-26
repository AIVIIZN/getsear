import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { calculateOverShort } from '@/lib/staff/denomination-calculator'

type RouteParams = { params: Promise<{ id: string }> }

const closeSchema = z.object({
  actual_cash: z.string(),
  denominations: z.record(z.string(), z.number().int().min(0)),
  manager_note: z.string().optional(),
})

/**
 * POST /api/staff/cash-drawers/[id]/close — close drawer with closing count
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

  const parsed = closeSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Get drawer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: drawer } = await (supabase.from('cash_drawers') as any)
    .select('id, is_open, expected_cash')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!drawer) {
    return apiError(404, 'Cash drawer not found')
  }

  if (!drawer.is_open) {
    return apiError(409, 'Drawer is not open')
  }

  // Calculate over/short
  const expectedCents = Math.round(parseFloat(drawer.expected_cash ?? '0') * 100)
  const actualCents = Math.round(parseFloat(parsed.data.actual_cash) * 100)
  const overShort = calculateOverShort(expectedCents, actualCents)

  const overShortDecimal = (overShort.differenceCents / 100).toFixed(2)
  const now = new Date().toISOString()

  // Update drawer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase.from('cash_drawers') as any)
    .update({
      is_open: false,
      actual_cash: parsed.data.actual_cash,
      over_short: overShortDecimal,
      closed_at: now,
      closed_by: user.id,
      updated_at: now,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to close drawer')
  }

  // Record closing count
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('cash_drawer_counts') as any)
      .insert({
        cash_drawer_id: id,
        count_type: 'closing',
        denominations: parsed.data.denominations,
        total: parsed.data.actual_cash,
        counted_by: user.id,
        created_at: now,
      })
  } catch {
    // table may not exist
  }

  // Record close event
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('cash_drawer_events') as any)
      .insert({
        cash_drawer_id: id,
        event_type: 'close_shift',
        amount: parseFloat(parsed.data.actual_cash),
        running_total: parseFloat(parsed.data.actual_cash),
        performed_by: user.id,
        description: `Closing count: $${parsed.data.actual_cash}. Over/Short: ${overShort.formattedDifference}${parsed.data.manager_note ? `. Note: ${parsed.data.manager_note}` : ''}`,
        created_at: now,
      })
  } catch {
    // table may not exist
  }

  return NextResponse.json({
    data: {
      drawer: updated,
      overShort: {
        expected: drawer.expected_cash,
        actual: parsed.data.actual_cash,
        difference: overShortDecimal,
        ...overShort,
      },
    },
  })
}
