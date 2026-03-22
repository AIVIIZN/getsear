import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * GET /api/payments/settlement — settlement report for date range
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
  let query = (supabase.from('payments') as any)
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

      // Track by card brand
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

  return NextResponse.json({ data: summary })
}
