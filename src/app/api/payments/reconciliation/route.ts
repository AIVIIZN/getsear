import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * GET /api/payments/reconciliation — daily reconciliation report
 *
 * Compares Valor settlement total vs Sear payment records for a given date.
 * Returns breakdown by payment method, card brand, tips, voids, refunds.
 * Flags discrepancies > $1.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleCheck = requireRole(user, ['manager', 'admin', 'owner', 'platform_admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const date = params.get('date') ?? new Date().toISOString().split('T')[0]
  const locationId = params.get('location_id')

  if (!locationId) {
    return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const startOfDay = `${date}T00:00:00Z`
  const endOfDay = `${date}T23:59:59Z`

  // ---------------------------------------------------------------------------
  // 1. Fetch settlement batch for this date
  // ---------------------------------------------------------------------------
  const { data: batches } = await (supabase.from('settlement_batches') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .gte('batch_closed_at', startOfDay)
    .lte('batch_closed_at', endOfDay)
    .order('batch_closed_at', { ascending: false })

  const batchList = (batches ?? []) as Record<string, unknown>[]
  const valorTotal = batchList.reduce(
    (sum, b) => sum + Math.round(parseFloat((b.net_amount as string) ?? '0') * 100),
    0
  )
  const valorGross = batchList.reduce(
    (sum, b) => sum + Math.round(parseFloat((b.gross_amount as string) ?? '0') * 100),
    0
  )

  // ---------------------------------------------------------------------------
  // 2. Fetch all Sear payment records for this date
  // ---------------------------------------------------------------------------
  const { data: allPayments } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)

  const payments = (allPayments ?? []) as Record<string, unknown>[]

  // ---------------------------------------------------------------------------
  // 3. Aggregate by payment method
  // ---------------------------------------------------------------------------
  const cardMethods = ['credit_card', 'debit_card', 'apple_pay', 'google_pay']

  let cardTotalCents = 0
  let cardTipCents = 0
  let cardCount = 0
  let cashTotalCents = 0
  let cashCount = 0
  let giftCardTotalCents = 0
  let giftCardCount = 0
  let houseAccountTotalCents = 0
  let houseAccountCount = 0
  let voidCount = 0
  let voidTotalCents = 0
  let refundTotalCents = 0
  let refundCount = 0

  const cardBrands: Record<string, { count: number; total_cents: number }> = {}

  for (const p of payments) {
    const method = p.payment_method as string
    const status = p.status as string
    const totalAmount = Math.round(parseFloat(p.total_amount as string) * 100)
    const tipAmount = Math.round(parseFloat((p.tip_amount as string) ?? '0') * 100)
    const refundAmount = Math.round(parseFloat((p.refund_amount as string) ?? '0') * 100)

    if (status === 'voided') {
      voidCount++
      voidTotalCents += totalAmount
      continue
    }

    if (refundAmount > 0) {
      refundCount++
      refundTotalCents += refundAmount
    }

    if (!['captured', 'settled', 'refunded'].includes(status)) continue

    if (cardMethods.includes(method)) {
      cardTotalCents += totalAmount
      cardTipCents += tipAmount
      cardCount++

      const brand = (p.card_brand as string) ?? 'unknown'
      if (!cardBrands[brand]) {
        cardBrands[brand] = { count: 0, total_cents: 0 }
      }
      cardBrands[brand].count++
      cardBrands[brand].total_cents += totalAmount
    } else if (method === 'cash') {
      cashTotalCents += totalAmount
      cashCount++
    } else if (method === 'gift_card') {
      giftCardTotalCents += totalAmount
      giftCardCount++
    } else if (method === 'house_account') {
      houseAccountTotalCents += totalAmount
      houseAccountCount++
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Calculate variance
  // ---------------------------------------------------------------------------
  const searCardTotal = cardTotalCents
  const difference = searCardTotal - valorGross
  const hasMismatch = Math.abs(difference) > 100 // Flag if > $1

  // Find specific mismatched transactions
  const mismatchedTransactions: string[] = []
  if (hasMismatch) {
    mismatchedTransactions.push(
      `Sear card total: $${(searCardTotal / 100).toFixed(2)}, Valor gross: $${(valorGross / 100).toFixed(2)}, Difference: $${(difference / 100).toFixed(2)}`
    )
  }

  // ---------------------------------------------------------------------------
  // 5. Gross/net revenue
  // ---------------------------------------------------------------------------
  const grossSalesCents = cardTotalCents + cashTotalCents + giftCardTotalCents + houseAccountTotalCents
  const netSalesCents = grossSalesCents - voidTotalCents - refundTotalCents

  return NextResponse.json({
    data: {
      date,
      location_id: locationId,

      revenue: {
        gross_sales_cents: grossSalesCents,
        void_cents: voidTotalCents,
        refund_cents: refundTotalCents,
        net_sales_cents: netSalesCents,
      },

      payment_breakdown: {
        card: { count: cardCount, total_cents: cardTotalCents, tip_cents: cardTipCents },
        cash: { count: cashCount, total_cents: cashTotalCents },
        gift_card: { count: giftCardCount, total_cents: giftCardTotalCents },
        house_account: { count: houseAccountCount, total_cents: houseAccountTotalCents },
      },

      card_detail: cardBrands,

      tips: {
        credit_card_tip_cents: cardTipCents,
      },

      adjustments: {
        voids: { count: voidCount, total_cents: voidTotalCents },
        refunds: { count: refundCount, total_cents: refundTotalCents },
      },

      batch_info: batchList.map((b) => ({
        batch_id: b.processor_batch_id,
        transaction_count: b.transaction_count,
        gross_cents: Math.round(parseFloat((b.gross_amount as string) ?? '0') * 100),
        net_cents: Math.round(parseFloat((b.net_amount as string) ?? '0') * 100),
        closed_at: b.batch_closed_at,
      })),

      reconciliation: {
        valor_total_cents: valorGross,
        sear_total_cents: searCardTotal,
        difference_cents: difference,
        has_discrepancy: hasMismatch,
        mismatched_transactions: mismatchedTransactions,
      },
    },
  })
}
