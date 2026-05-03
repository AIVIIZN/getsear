import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { calculateServerCheckout } from '@/lib/staff/server-checkout'

const checkoutSchema = z.object({
  user_id: z.string().uuid(),
  date: z.string(),
  location_id: z.string().uuid(),
  cash_tips_declared_cents: z.number().int().min(0),
  starting_cash_cents: z.number().int().min(0).default(0),
})

/**
 * POST /api/staff/checkout — calculate server checkout report
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'server', 'bartender'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { user_id, date, location_id, cash_tips_declared_cents, starting_cash_cents } = parsed.data
  const supabase = createAdminClient()

  // Get the time entry for this shift
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: timeEntry } = await (supabase.from('time_entries') as any)
    .select('*')
    .eq('user_id', user_id)
    .eq('location_id', location_id)
    .gte('clock_in', `${date}T00:00:00Z`)
    .lte('clock_in', `${date}T23:59:59Z`)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!timeEntry) {
    return NextResponse.json({ error: 'No time entry found for this employee on this date' }, { status: 404 })
  }

  // Get orders closed by this server during the shift
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders } = await (supabase.from('orders') as any)
    .select(`
      id,
      subtotal,
      tax,
      total,
      guest_count,
      payments:payments(payment_method, amount, tip_amount, auto_gratuity)
    `)
    .eq('server_id', user_id)
    .eq('location_id', location_id)
    .gte('created_at', `${date}T00:00:00Z`)
    .lte('created_at', `${date}T23:59:59Z`)
    .in('status', ['closed', 'settled'])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderData = (orders ?? []).map((o: any) => {
     
    const payments = o.payments ?? []
    const tipCents = Math.round(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payments.reduce((s: number, p: any) => s + parseFloat(p.tip_amount ?? '0') * 100, 0)
    )
    const autoGratCents = Math.round(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payments.reduce((s: number, p: any) => s + parseFloat(p.auto_gratuity ?? '0') * 100, 0)
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cashReceived = payments.filter((p: any) => p.payment_method === 'cash')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .reduce((s: number, p: any) => s + Math.round(parseFloat(p.amount ?? '0') * 100), 0)
     
    const paymentMethod = payments.length > 0 ? payments[0].payment_method : 'cash'

    return {
      orderId: o.id,
      subtotalCents: Math.round(parseFloat(o.subtotal ?? '0') * 100),
      taxCents: Math.round(parseFloat(o.tax ?? '0') * 100),
      totalCents: Math.round(parseFloat(o.total ?? '0') * 100),
      guestCount: o.guest_count ?? 1,
      paymentMethod,
      tipCents,
      autoGratuityCents: autoGratCents,
      cashReceivedCents: cashReceived,
    }
  })

  // Get tip-out data
  const tipOutGiven = Math.round(parseFloat(timeEntry.tip_out_given ?? '0') * 100)
  const tipOutReceived = Math.round(parseFloat(timeEntry.tip_out_received ?? '0') * 100)

  const result = calculateServerCheckout({
    timeEntry: {
      id: timeEntry.id,
      clockIn: timeEntry.clock_in,
      clockOut: timeEntry.clock_out,
      regularHours: timeEntry.regular_hours ?? 0,
      overtimeHours: timeEntry.overtime_hours ?? 0,
      hourlyRateCents: Math.round(parseFloat(timeEntry.hourly_rate ?? '0') * 100),
    },
    orders: orderData,
    tipOutOwedCents: tipOutGiven,
    tipOutReceivedCents: tipOutReceived,
    cashTipsDeclaredCents: cash_tips_declared_cents,
    startingCashCents: starting_cash_cents,
  })

  return NextResponse.json({ data: result })
}
