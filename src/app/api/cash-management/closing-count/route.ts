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

const closingCountSchema = z.object({
  drawer_id: z.string().uuid(),
  denominations: denominationSchema,
  total_cents: z.number().int().min(0),
  notes: z.string().max(500).optional(),
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
 * Determines over/short severity level based on variance.
 */
function getVarianceSeverity(varianceCents: number): 'green' | 'yellow' | 'red' {
  const absVariance = Math.abs(varianceCents)
  if (absVariance <= 500) return 'green'     // Under $5
  if (absVariance <= 2000) return 'yellow'   // $5 - $20
  return 'red'                                // Over $20
}

/**
 * POST /api/cash-management/closing-count — record closing drawer count at end of shift
 *
 * Calculates expected balance: opening + cash sales - cash payouts - cash drops
 * Calculates over/short: actual count - expected
 * Returns color-coded severity: green (<$5), yellow ($5-$20), red (>$20)
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = closingCountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { drawer_id, denominations, total_cents, notes } = parsed.data
  const supabase = createAdminClient()

  // Verify drawer exists and is open
  const { data: drawer, error: drawerErr } = await (supabase.from('cash_drawers') as ReturnType<typeof supabase.from>)
    .select('id, org_id, location_id, is_open, starting_cash, expected_cash')
    .eq('id', drawer_id)
    .eq('org_id', user.org_id)
    .single()

  if (drawerErr || !drawer) {
    return NextResponse.json({ error: 'Cash drawer not found' }, { status: 404 })
  }

  const drawerData = drawer as Record<string, unknown>

  if (!drawerData.is_open) {
    return NextResponse.json(
      { error: 'Drawer is not open. Cannot perform closing count.' },
      { status: 409 }
    )
  }

  // Validate total matches denomination count
  const calculatedTotal = calculateDenominationTotal(denominations)
  if (Math.abs(calculatedTotal - total_cents) > 1) {
    return NextResponse.json(
      {
        error: 'Total does not match denomination count',
        calculated_cents: calculatedTotal,
        provided_cents: total_cents,
      },
      { status: 400 }
    )
  }

  // Calculate expected cash from all drawer events
  const startingCashCents = Math.round(parseFloat((drawerData.starting_cash as string) ?? '0') * 100)

  // Sum up all cash events since opening
  const { data: events } = await (supabase.from('cash_drawer_events') as ReturnType<typeof supabase.from>)
    .select('event_type, amount')
    .eq('cash_drawer_id', drawer_id)
    .neq('event_type', 'open_shift')
    .order('created_at', { ascending: true })

  let cashSalesCents = 0
  let cashRefundsCents = 0
  let cashDropsCents = 0
  let paidOutCents = 0
  let paidInCents = 0
  let tipPayoutCents = 0

  if (events) {
    for (const evt of events as Record<string, unknown>[]) {
      const amount = Math.round(parseFloat(evt.amount as string) * 100)
      switch (evt.event_type) {
        case 'cash_sale':
          cashSalesCents += amount
          break
        case 'cash_refund':
          cashRefundsCents += amount
          break
        case 'paid_out':
          paidOutCents += amount
          break
        case 'paid_in':
          paidInCents += amount
          break
        case 'tip_payout':
          tipPayoutCents += amount
          break
        case 'count':
          // Mid-shift counts don't affect expected
          break
        default:
          // Cash drops reduce expected (recorded as negative in events)
          if (evt.event_type === 'no_sale') {
            // No-sale drawer open — no cash impact
          }
          break
      }
    }
  }

  // Expected = opening + sales + paid_in - refunds - drops - paid_out - tip_payouts
  const expectedCents = startingCashCents + cashSalesCents + paidInCents -
    cashRefundsCents - cashDropsCents - paidOutCents - tipPayoutCents

  // Over/short = actual - expected
  const overShortCents = total_cents - expectedCents
  const severity = getVarianceSeverity(overShortCents)

  const actualDecimal = (total_cents / 100).toFixed(2)
  const expectedDecimal = (expectedCents / 100).toFixed(2)
  const overShortDecimal = (overShortCents / 100).toFixed(2)

  // Update drawer
  const { error: updateErr } = await (supabase.from('cash_drawers') as ReturnType<typeof supabase.from>)
    .update({
      is_open: false,
      actual_cash: actualDecimal,
      expected_cash: expectedDecimal,
      over_short: overShortDecimal,
      closed_by: user.id,
      closed_at: new Date().toISOString(),
      notes: notes ?? null,
    })
    .eq('id', drawer_id)

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to close drawer' }, { status: 500 })
  }

  // Record closing count event
  const { data: event, error: eventErr } = await (supabase.from('cash_drawer_events') as ReturnType<typeof supabase.from>)
    .insert({
      cash_drawer_id: drawer_id,
      event_type: 'close_shift',
      amount: actualDecimal,
      running_total: actualDecimal,
      description: `Closing count. Over/Short: $${overShortDecimal}`,
      performed_by: user.id,
    })
    .select()
    .single()

  if (eventErr) {
    return NextResponse.json({ error: 'Failed to record closing count event' }, { status: 500 })
  }

  // Audit trail for significant variances
  if (Math.abs(overShortCents) > 500) {
    await (supabase.from('audit_log') as ReturnType<typeof supabase.from>)
      .insert({
        org_id: user.org_id,
        location_id: drawerData.location_id,
        user_id: user.id,
        action: 'cash_drawer_variance',
        entity_type: 'cash_drawer',
        entity_id: drawer_id,
        details: {
          over_short_cents: overShortCents,
          expected_cents: expectedCents,
          actual_cents: total_cents,
          severity,
          requires_investigation: severity === 'red',
        },
      })
  }

  return NextResponse.json({
    data: {
      drawer_id,
      event,
      closing_summary: {
        starting_cash_cents: startingCashCents,
        cash_sales_cents: cashSalesCents,
        cash_refunds_cents: cashRefundsCents,
        paid_in_cents: paidInCents,
        paid_out_cents: paidOutCents,
        tip_payouts_cents: tipPayoutCents,
        expected_cents: expectedCents,
        actual_cents: total_cents,
        over_short_cents: overShortCents,
        severity,
        denominations,
      },
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    },
  })
}
