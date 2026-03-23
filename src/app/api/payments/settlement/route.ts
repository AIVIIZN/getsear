import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getValorClient } from '@/lib/payments/valor-client-loader'

const settlementSchema = z.object({
  location_id: z.string().uuid(),
  force: z.boolean().optional().default(false), // Skip pre-checks
})

/**
 * GET /api/payments/settlement — settlement summary report for date range
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleCheck = requireRole(user, ['manager', 'admin', 'owner', 'platform_admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const dateFrom = params.get('date_from') ?? new Date().toISOString().split('T')[0]
  const dateTo = params.get('date_to') ?? new Date().toISOString().split('T')[0]
  const locationId = params.get('location_id')

  const supabase = createAdminClient()

  // Fetch all payments in date range
  let query = (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('org_id', user.org_id)
    .gte('created_at', `${dateFrom}T00:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)
    .in('status', ['captured', 'settled'])

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data: payments, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch settlement data' }, { status: 500 })
  }

  const paymentsList = (payments ?? []) as Array<Record<string, unknown>>

  // Aggregate by method
  const summary = {
    date_from: dateFrom,
    date_to: dateTo,
    card: { count: 0, amount_cents: 0, tip_cents: 0, total_cents: 0 },
    cash: { count: 0, amount_cents: 0, tip_cents: 0, total_cents: 0 },
    gift_card: { count: 0, amount_cents: 0, tip_cents: 0, total_cents: 0 },
    other: { count: 0, amount_cents: 0, tip_cents: 0, total_cents: 0 },
    totals: { count: 0, amount_cents: 0, tip_cents: 0, total_cents: 0, refund_cents: 0 },
    card_brands: {} as Record<string, { count: number; total_cents: number }>,
    voids: { count: 0, total_cents: 0 },
  }

  for (const p of paymentsList) {
    const amount = Math.round(parseFloat(p.amount as string) * 100)
    const tip = Math.round(parseFloat((p.tip_amount as string) ?? '0') * 100)
    const total = Math.round(parseFloat(p.total_amount as string) * 100)
    const refund = Math.round(parseFloat((p.refund_amount as string) ?? '0') * 100)
    const method = p.payment_method as string

    summary.totals.count++
    summary.totals.amount_cents += amount
    summary.totals.tip_cents += tip
    summary.totals.total_cents += total
    summary.totals.refund_cents += refund

    if (['credit_card', 'debit_card', 'apple_pay', 'google_pay'].includes(method)) {
      summary.card.count++
      summary.card.amount_cents += amount
      summary.card.tip_cents += tip
      summary.card.total_cents += total

      const brand = (p.card_brand as string) ?? 'unknown'
      if (!summary.card_brands[brand]) {
        summary.card_brands[brand] = { count: 0, total_cents: 0 }
      }
      summary.card_brands[brand].count++
      summary.card_brands[brand].total_cents += total
    } else if (method === 'cash') {
      summary.cash.count++
      summary.cash.amount_cents += amount
      summary.cash.tip_cents += tip
      summary.cash.total_cents += total
    } else if (method === 'gift_card') {
      summary.gift_card.count++
      summary.gift_card.amount_cents += amount
      summary.gift_card.tip_cents += tip
      summary.gift_card.total_cents += total
    } else {
      summary.other.count++
      summary.other.amount_cents += amount
      summary.other.tip_cents += tip
      summary.other.total_cents += total
    }
  }

  // Count voids for the period
  const { data: voids } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('total_amount')
    .eq('org_id', user.org_id)
    .eq('status', 'voided')
    .gte('refunded_at', `${dateFrom}T00:00:00Z`)
    .lte('refunded_at', `${dateTo}T23:59:59Z`)

  if (voids) {
    for (const v of voids as Record<string, unknown>[]) {
      summary.voids.count++
      summary.voids.total_cents += Math.round(parseFloat(v.total_amount as string) * 100)
    }
  }

  return NextResponse.json({ data: summary })
}

/**
 * POST /api/payments/settlement — trigger manual batch settlement
 *
 * Calls Valor batch close API, records settlement results,
 * marks all captured transactions as settled.
 * Requires manager role.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleCheck = requireRole(user, ['manager', 'admin', 'owner', 'platform_admin'])
  if (roleCheck) return roleCheck

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = settlementSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { location_id, force } = parsed.data
  const supabase = createAdminClient()

  // Verify location belongs to org
  const { data: location } = await (supabase.from('locations') as ReturnType<typeof supabase.from>)
    .select('id, name')
    .eq('id', location_id)
    .eq('org_id', user.org_id)
    .single()

  if (!location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  // Pre-settlement checks (unless forced)
  if (!force) {
    // Check for open bar tabs
    const { data: openTabs } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
      .select('id, order_id')
      .eq('org_id', user.org_id)
      .eq('location_id', location_id)
      .eq('status', 'authorized')

    const openTabCount = (openTabs as unknown[] | null)?.length ?? 0

    // Check for un-tipped captured transactions
    const { data: noTipPayments } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
      .select('id')
      .eq('org_id', user.org_id)
      .eq('location_id', location_id)
      .eq('status', 'captured')
      .eq('tip_amount', '0.00')
      .in('payment_method', ['credit_card', 'debit_card'])

    const noTipCount = (noTipPayments as unknown[] | null)?.length ?? 0

    if (openTabCount > 0 || noTipCount > 0) {
      return NextResponse.json({
        error: 'Pre-settlement checks failed',
        warnings: {
          open_tabs: openTabCount,
          transactions_without_tips: noTipCount,
          message: `${openTabCount} open tab(s) and ${noTipCount} transaction(s) without tips. Set force=true to settle anyway.`,
        },
      }, { status: 409 })
    }
  }

  // Get all captured (unsettled) card transactions for this location
  const { data: unsettledPayments } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('id, total_amount, tip_amount, refund_amount, payment_method, card_brand')
    .eq('org_id', user.org_id)
    .eq('location_id', location_id)
    .eq('status', 'captured')
    .in('payment_method', ['credit_card', 'debit_card', 'apple_pay', 'google_pay'])

  const unsettled = (unsettledPayments ?? []) as Record<string, unknown>[]

  if (unsettled.length === 0) {
    return NextResponse.json(
      { error: 'No unsettled transactions to settle' },
      { status: 400 }
    )
  }

  // Calculate batch totals
  let grossCents = 0
  let refundCents = 0
  for (const p of unsettled) {
    grossCents += Math.round(parseFloat(p.total_amount as string) * 100)
    refundCents += Math.round(parseFloat((p.refund_amount as string) ?? '0') * 100)
  }
  const netCents = grossCents - refundCents

  // Call Valor batch close
  const valor = getValorClient()
  const batchResult = await valor.batchClose({ location_id })

  if (!batchResult.success) {
    return NextResponse.json(
      { error: 'Batch settlement failed at processor' },
      { status: 502 }
    )
  }

  // Record settlement batch
  const { data: batch, error: batchErr } = await (supabase.from('settlement_batches') as ReturnType<typeof supabase.from>)
    .insert({
      org_id: user.org_id,
      location_id,
      processor_batch_id: batchResult.batch_id,
      transaction_count: unsettled.length,
      gross_amount: (grossCents / 100).toFixed(2),
      refund_amount: (refundCents / 100).toFixed(2),
      net_amount: (netCents / 100).toFixed(2),
      batch_closed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (batchErr) {
    return NextResponse.json(
      { error: 'Failed to record settlement batch' },
      { status: 500 }
    )
  }

  // Mark all captured transactions as settled
  const paymentIds = unsettled.map((p) => p.id as string)
  await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .update({ status: 'settled' })
    .in('id', paymentIds)

  // Check for mismatches between our total and Valor's reported total
  const valorGross = batchResult.gross_amount_cents
  const mismatched: string[] = []
  if (valorGross > 0 && Math.abs(valorGross - grossCents) > 100) {
    mismatched.push(
      `Sear total: $${(grossCents / 100).toFixed(2)}, Valor total: $${(valorGross / 100).toFixed(2)}`
    )
  }

  // Create audit trail
  await (supabase.from('audit_log') as ReturnType<typeof supabase.from>)
    .insert({
      org_id: user.org_id,
      location_id,
      user_id: user.id,
      action: 'batch_settled',
      entity_type: 'payment',
      entity_id: (batch as Record<string, unknown>).id as string,
      details: {
        batch_id: batchResult.batch_id,
        transaction_count: unsettled.length,
        gross_cents: grossCents,
        net_cents: netCents,
        refund_cents: refundCents,
        mismatches: mismatched,
      },
    })

  return NextResponse.json({
    data: {
      batch,
      settlement_summary: {
        batch_id: batchResult.batch_id,
        transaction_count: unsettled.length,
        gross_amount_cents: grossCents,
        refund_amount_cents: refundCents,
        net_amount_cents: netCents,
        mismatched_transactions: mismatched,
      },
    },
  })
}
