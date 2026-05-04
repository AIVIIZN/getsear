import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { withIdempotency } from '@/lib/api/idempotency'
import { valorClient } from '@/lib/payments/valor-client'
import { getReqLoggerFromRequest } from '@/lib/observability/req-context'
import crypto from 'crypto'

const processPaymentSchema = z.object({
  order_id: z.string().uuid(),
  location_id: z.string().uuid(),
  payment_method: z.enum([
    'cash',
    'credit_card',
    'debit_card',
    'gift_card',
    'house_account',
    'apple_pay',
    'google_pay',
  ]),
  amount_cents: z.number().int().min(1),
  tip_cents: z.number().int().min(0).optional().default(0),
  /**
   * Payment mode:
   * - 'sale': auth + capture in one step (counter-service, tip-on-screen)
   * - 'auth_only': authorize only, capture later (full-service, tip-on-receipt)
   */
  mode: z.enum(['sale', 'auth_only']).optional().default('sale'),
  /** Terminal ID for Valor Connect (optional, uses REST if not provided) */
  terminal_id: z.string().optional(),
  // Cash-specific
  cash_tendered_cents: z.number().int().min(0).optional(),
  // Gift card-specific
  gift_card_number: z.string().optional(),
})

/**
 * POST /api/payments/process
 *
 * Process a payment: card (via Valor), cash, gift card, or house account.
 * For card payments, supports both 'sale' (auth+capture) and 'auth_only'
 * (pre-auth for tip-on-receipt flow).
 *
 * Wrapped with `withIdempotency` (V5.3.1). The offline queue retries
 * payments aggressively on reconnect — a duplicate charge is one of the
 * worst possible bugs in a POS, so dedup is non-negotiable here. Server
 * dedupes by `(Idempotency-Key, route, org_id)`.
 */
export const POST = withIdempotency('payments.process', async (request: NextRequest) => {
  const t0 = Date.now()
  const rlog = getReqLoggerFromRequest(request, {
    route: '/api/payments/process',
    method: 'POST',
  })

  const user = await getAuthUser()
  if (user instanceof NextResponse) {
    rlog.warn('payments.process.unauthorized', {
      status: user.status,
      duration_ms: Date.now() - t0,
    })
    return user
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    rlog.warn('payments.process.invalid_json', {
      user_id: user.id,
      org_id: user.org_id,
      status: 400,
      duration_ms: Date.now() - t0,
    })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = processPaymentSchema.safeParse(body)
  if (!parsed.success) {
    rlog.warn('payments.process.validation_failed', {
      user_id: user.id,
      org_id: user.org_id,
      status: 400,
      duration_ms: Date.now() - t0,
    })
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const {
    order_id,
    location_id,
    payment_method,
    amount_cents,
    tip_cents,
    mode,
    terminal_id,
    cash_tendered_cents,
    gift_card_number,
  } = parsed.data

  const total_cents = amount_cents + tip_cents
  const supabase = createAdminClient()

  rlog.info('payments.process.start', {
    user_id: user.id,
    org_id: user.org_id,
    order_id,
    location_id,
    payment_method,
    total_cents,
    mode,
  })

  // Verify order exists and belongs to org
  const { data: order, error: orderErr } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('id, org_id, total, balance_due, amount_paid, status')
    .eq('id', order_id)
    .eq('org_id', user.org_id)
    .single()

  if (orderErr || !order) {
    rlog.warn('payments.process.order_not_found', {
      user_id: user.id,
      org_id: user.org_id,
      order_id,
      status: 404,
      duration_ms: Date.now() - t0,
    })
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

  // ---------------------------------------------------------------------------
  // Card payment via Valor
  // ---------------------------------------------------------------------------
  if (
    payment_method === 'credit_card' ||
    payment_method === 'debit_card' ||
    payment_method === 'apple_pay' ||
    payment_method === 'google_pay'
  ) {
    try {
      const valorRequest = {
        amount_cents: total_cents,
        order_id,
        terminal_id,
        capture: mode === 'sale',
      }

      // Use sale() for auth+capture, authorize() for auth-only
      const result = mode === 'sale'
        ? await valorClient.sale(valorRequest)
        : await valorClient.authorize(valorRequest)

      paymentRecord.processor_response = result
      paymentRecord.card_last_four = result.card_last_four
      paymentRecord.card_brand = result.card_brand
      paymentRecord.auth_code = result.auth_code
      paymentRecord.processor_transaction_id = result.transaction_id

      if (result.success) {
        if (mode === 'sale') {
          // Sale: auth + capture done — payment is complete
          paymentRecord.status = 'captured'
        } else {
          // Auth only: card is held, capture later with tip
          paymentRecord.status = 'authorized'
        }
      } else {
        // Declined
        paymentRecord.status = 'declined'

        // Insert declined record for audit trail
        const { data: declined } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
          .insert(paymentRecord)
          .select()
          .single()

        rlog.warn('payments.process.declined', {
          user_id: user.id,
          org_id: user.org_id,
          order_id,
          payment_method,
          decline_code: result.decline_code,
          status: 402,
          duration_ms: Date.now() - t0,
        })

        return NextResponse.json(
          {
            error: 'Payment declined',
            reason: result.decline_reason ?? 'Card declined',
            decline_code: result.decline_code,
            data: declined,
          },
          { status: 402 }
        )
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment processing error'
      paymentRecord.status = 'error'
      paymentRecord.processor_response = { error: errorMessage }

      // Record the failed attempt
      await (supabase.from('payments') as ReturnType<typeof supabase.from>)
        .insert(paymentRecord)
        .select()
        .single()

      rlog.error('payments.process.processor_error', {
        user_id: user.id,
        org_id: user.org_id,
        order_id,
        payment_method,
        err: errorMessage,
        err_stack: err instanceof Error ? err.stack : undefined,
        status: 500,
        duration_ms: Date.now() - t0,
      })

      return NextResponse.json(
        { error: 'Payment processing failed', reason: errorMessage },
        { status: 500 }
      )
    }
  }
  // ---------------------------------------------------------------------------
  // Cash payment
  // ---------------------------------------------------------------------------
  else if (payment_method === 'cash') {
    const tendered = cash_tendered_cents ?? total_cents
    if (tendered < total_cents) {
      return NextResponse.json(
        { error: 'Cash tendered is less than total' },
        { status: 400 }
      )
    }
    paymentRecord.status = 'captured'
    paymentRecord.cash_tendered = (tendered / 100).toFixed(2)
    paymentRecord.change_due = ((tendered - total_cents) / 100).toFixed(2)
  }
  // ---------------------------------------------------------------------------
  // Gift card payment
  // ---------------------------------------------------------------------------
  else if (payment_method === 'gift_card') {
    if (!gift_card_number) {
      return NextResponse.json(
        { error: 'Gift card number required' },
        { status: 400 }
      )
    }

    const cardHash = crypto.createHash('sha256').update(gift_card_number).digest('hex')

    const { data: card, error: cardErr } = await (supabase.from('gift_cards') as ReturnType<typeof supabase.from>)
      .select('id, current_balance, is_active')
      .eq('card_number_hash', cardHash)
      .eq('org_id', user.org_id)
      .single()

    if (cardErr || !card) {
      return NextResponse.json({ error: 'Gift card not found' }, { status: 404 })
    }

    const cardRecord = card as { id: string; current_balance: string; is_active: boolean }

    if (!cardRecord.is_active) {
      return NextResponse.json({ error: 'Gift card is inactive' }, { status: 400 })
    }

    const balanceCents = Math.round(parseFloat(cardRecord.current_balance) * 100)
    if (balanceCents < total_cents) {
      return NextResponse.json(
        { error: 'Insufficient gift card balance', balance_cents: balanceCents },
        { status: 400 }
      )
    }

    // Deduct from gift card
    const newBalance = ((balanceCents - total_cents) / 100).toFixed(2)
    await (supabase.from('gift_cards') as ReturnType<typeof supabase.from>)
      .update({ current_balance: newBalance })
      .eq('id', cardRecord.id)

    // Record gift card transaction
    await (supabase.from('gift_card_transactions') as ReturnType<typeof supabase.from>)
      .insert({
        gift_card_id: cardRecord.id,
        order_id,
        amount: (total_cents / 100).toFixed(2),
        transaction_type: 'redeem',
        balance_after: newBalance,
      })

    paymentRecord.status = 'captured'
    paymentRecord.gift_card_id = cardRecord.id
  }
  // ---------------------------------------------------------------------------
  // House account / other
  // ---------------------------------------------------------------------------
  else {
    paymentRecord.status = 'captured'
  }

  // Insert payment
  const { data: payment, error: paymentErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .insert(paymentRecord)
    .select()
    .single()

  if (paymentErr) {
    return NextResponse.json(
      { error: 'Failed to create payment record' },
      { status: 500 }
    )
  }

  const paymentData = payment as Record<string, unknown>

  // Update order amount_paid and balance_due (only for captured/authorized payments)
  if (paymentRecord.status === 'captured') {
    const orderData = order as { amount_paid?: string; balance_due?: string; total?: string }
    const currentPaid = Math.round(parseFloat(orderData.amount_paid ?? '0') * 100)
    const currentBalance = Math.round(
      parseFloat(orderData.balance_due ?? orderData.total ?? '0') * 100
    )
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

    await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update(orderUpdate)
      .eq('id', order_id)
  }

  rlog.info('payments.process.ok', {
    user_id: user.id,
    org_id: user.org_id,
    order_id,
    payment_id: (paymentData as { id?: string })?.id,
    payment_method,
    payment_status: paymentRecord.status,
    total_cents,
    status: 201,
    duration_ms: Date.now() - t0,
  })

  return NextResponse.json(
    {
      data: {
        ...paymentData,
        change_due_cents:
          payment_method === 'cash'
            ? Math.round(parseFloat((paymentData.change_due as string) ?? '0') * 100)
            : 0,
      },
    },
    { status: 201 }
  )
})
