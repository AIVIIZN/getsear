import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { valorMock } from '@/lib/payments/valor-mock'
import crypto from 'crypto'

const processPaymentSchema = z.object({
  order_id: z.string().uuid(),
  location_id: z.string().uuid(),
  payment_method: z.enum(['cash', 'credit_card', 'debit_card', 'gift_card', 'house_account', 'apple_pay', 'google_pay']),
  amount_cents: z.number().int().min(1),
  tip_cents: z.number().int().min(0).optional().default(0),
  // Cash-specific
  cash_tendered_cents: z.number().int().min(0).optional(),
  // Gift card-specific
  gift_card_number: z.string().optional(),
})

/**
 * POST /api/payments/process — process a payment (card, cash, gift card)
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

  const parsed = processPaymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { order_id, location_id, payment_method, amount_cents, tip_cents, cash_tendered_cents, gift_card_number } = parsed.data
  const total_cents = amount_cents + tip_cents
  const supabase = createAdminClient()

  // Verify order exists and belongs to org
  const { data: order, error: orderErr } = await (supabase.from('orders') as any)
    .select('id, org_id, total, balance_due, status')
    .eq('id', order_id)
    .eq('org_id', user.org_id)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Build payment record
  const paymentRecord: Record<string, unknown> = {
    org_id: user.org_id,
    location_id,
    order_id,
    payment_method,
    amount: (amount_cents / 100).toFixed(2),
    tip_amount: (tip_cents / 100).toFixed(2),
    total_amount: (total_cents / 100).toFixed(2),
    status: 'pending',
    processed_by: user.id,
    processor_response: {},
  }

  // Handle payment by method
  if (payment_method === 'credit_card' || payment_method === 'debit_card' || payment_method === 'apple_pay' || payment_method === 'google_pay') {
    // Card payment via Valor mock
    const authResult = await valorMock.authorize({
      amount_cents: total_cents,
      order_id,
    })

    paymentRecord.processor_response = authResult
    paymentRecord.card_last_four = authResult.card_last_four
    paymentRecord.card_brand = authResult.card_brand
    paymentRecord.reference_number = authResult.auth_code

    if (authResult.success) {
      paymentRecord.status = 'captured'
      paymentRecord.processor_transaction_id = authResult.transaction_id
    } else {
      paymentRecord.status = 'declined'

      // Insert declined record
      const { data: declined } = await (supabase.from('payments') as any)
        .insert(paymentRecord)
        .select()
        .single()

      return NextResponse.json(
        { error: 'Payment declined', reason: authResult.decline_reason, data: declined },
        { status: 402 }
      )
    }
  } else if (payment_method === 'cash') {
    const tendered = cash_tendered_cents ?? total_cents
    if (tendered < total_cents) {
      return NextResponse.json({ error: 'Cash tendered is less than total' }, { status: 400 })
    }
    paymentRecord.status = 'captured'
    paymentRecord.cash_tendered = (tendered / 100).toFixed(2)
    paymentRecord.change_due = ((tendered - total_cents) / 100).toFixed(2)
  } else if (payment_method === 'gift_card') {
    if (!gift_card_number) {
      return NextResponse.json({ error: 'Gift card number required' }, { status: 400 })
    }

    const cardHash = crypto.createHash('sha256').update(gift_card_number).digest('hex')

    const { data: card, error: cardErr } = await (supabase.from('gift_cards') as any)
      .select('id, balance, is_active')
      .eq('card_number_hash', cardHash)
      .eq('org_id', user.org_id)
      .single()

    if (cardErr || !card) {
      return NextResponse.json({ error: 'Gift card not found' }, { status: 404 })
    }

    if (!card.is_active) {
      return NextResponse.json({ error: 'Gift card is inactive' }, { status: 400 })
    }

    const balanceCents = Math.round(parseFloat(card.balance) * 100)
    if (balanceCents < total_cents) {
      return NextResponse.json(
        { error: 'Insufficient gift card balance', balance_cents: balanceCents },
        { status: 400 }
      )
    }

    // Deduct from gift card
    const newBalance = ((balanceCents - total_cents) / 100).toFixed(2)
    await (supabase.from('gift_cards') as any)
      .update({ balance: newBalance })
      .eq('id', card.id)

    // Record gift card transaction
    await (supabase.from('gift_card_transactions') as any)
      .insert({
        gift_card_id: card.id,
        order_id,
        amount: (total_cents / 100).toFixed(2),
        type: 'redeem',
        balance_after: newBalance,
      })

    paymentRecord.status = 'captured'
    paymentRecord.gift_card_id = card.id
  } else {
    // house_account or other — mark captured
    paymentRecord.status = 'captured'
  }

  // Insert payment
  const { data: payment, error: paymentErr } = await (supabase.from('payments') as any)
    .insert(paymentRecord)
    .select()
    .single()

  if (paymentErr) {
    return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 })
  }

  // Update order amount_paid and balance_due
  const currentPaid = Math.round(parseFloat(order.amount_paid ?? '0') * 100)
  const currentBalance = Math.round(parseFloat(order.balance_due ?? order.total ?? '0') * 100)
  const newPaid = currentPaid + total_cents
  const newBalance = Math.max(0, currentBalance - total_cents)

  const orderUpdate: Record<string, unknown> = {
    amount_paid: (newPaid / 100).toFixed(2),
    balance_due: (newBalance / 100).toFixed(2),
  }

  // Close order if fully paid
  if (newBalance === 0) {
    orderUpdate.status = 'closed'
  }

  await (supabase.from('orders') as any)
    .update(orderUpdate)
    .eq('id', order_id)

  return NextResponse.json({
    data: {
      ...payment,
      change_due_cents: payment_method === 'cash'
        ? Math.round(parseFloat(payment.change_due ?? '0') * 100)
        : 0,
    },
  }, { status: 201 })
}
