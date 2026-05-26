import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const denominationSchema = z.object({
  hundreds: z.number().int().min(0).default(0),
  fifties: z.number().int().min(0).default(0),
  twenties: z.number().int().min(0).default(0),
  tens: z.number().int().min(0).default(0),
  fives: z.number().int().min(0).default(0),
  ones: z.number().int().min(0).default(0),
  quarters: z.number().int().min(0).default(0),
  dimes: z.number().int().min(0).default(0),
  nickels: z.number().int().min(0).default(0),
  pennies: z.number().int().min(0).default(0),
})

const openingCountSchema = z.object({
  drawer_id: z.string().uuid(),
  denominations: denominationSchema,
  total_cents: z.number().int().min(0),
})

/**
 * Calculates total from denomination counts (in cents).
 */
function calculateDenominationTotal(d: z.infer<typeof denominationSchema>): number {
  return (
    d.hundreds * 10000 +
    d.fifties * 5000 +
    d.twenties * 2000 +
    d.tens * 1000 +
    d.fives * 500 +
    d.ones * 100 +
    d.quarters * 25 +
    d.dimes * 10 +
    d.nickels * 5 +
    d.pennies * 1
  )
}

/**
 * POST /api/cash-management/opening-count — record opening drawer count at start of shift
 *
 * Records the denomination breakdown and total for the starting bank.
 * Opens the cash drawer for the shift.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = openingCountSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { drawer_id, denominations, total_cents } = parsed.data
  const supabase = createAdminClient()

  // Verify drawer exists and belongs to org
  const { data: drawer, error: drawerErr } = await (supabase.from('cash_drawers') as ReturnType<typeof supabase.from>)
    .select('id, org_id, location_id, is_open')
    .eq('id', drawer_id)
    .eq('org_id', user.org_id)
    .single()

  if (drawerErr || !drawer) {
    return apiError(404, 'Cash drawer not found')
  }

  const drawerData = drawer as Record<string, unknown>

  if (drawerData.is_open) {
    return apiError(409, 'Drawer is already open. Close it before starting a new shift.')
  }

  // Validate total matches denomination count
  const calculatedTotal = calculateDenominationTotal(denominations)
  if (Math.abs(calculatedTotal - total_cents) > 1) {
    return apiError(400, 'Total does not match denomination count', { extra: { "calculated_cents": calculatedTotal, "provided_cents": total_cents } })
  }

  const totalDecimal = (total_cents / 100).toFixed(2)

  // Open the drawer
  const { error: updateErr } = await (supabase.from('cash_drawers') as ReturnType<typeof supabase.from>)
    .update({
      is_open: true,
      opened_by: user.id,
      opened_at: new Date().toISOString(),
      starting_cash: totalDecimal,
      current_cash: totalDecimal,
      expected_cash: totalDecimal,
      actual_cash: null,
      over_short: null,
      closed_by: null,
      closed_at: null,
    })
    .eq('id', drawer_id)

  if (updateErr) {
    return apiError(500, 'Failed to open drawer')
  }

  // Record the opening count event
  const { data: event, error: eventErr } = await (supabase.from('cash_drawer_events') as ReturnType<typeof supabase.from>)
    .insert({
      cash_drawer_id: drawer_id,
      event_type: 'open_shift',
      amount: totalDecimal,
      running_total: totalDecimal,
      description: 'Opening count',
      performed_by: user.id,
    })
    .select()
    .single()

  if (eventErr) {
    return apiError(500, 'Failed to record opening count event')
  }

  return NextResponse.json({
    data: {
      drawer_id,
      event: event,
      opening_total_cents: total_cents,
      denominations,
      opened_at: new Date().toISOString(),
      opened_by: user.id,
    },
  }, { status: 201 })
}
