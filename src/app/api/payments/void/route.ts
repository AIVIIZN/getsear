import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getValorClient } from '@/lib/payments/valor-client-loader'
import { compare } from 'bcryptjs'

const VOID_REASON_CODES = [
  'customer_request',
  'wrong_amount',
  'duplicate_charge',
  'fraud_suspected',
  'other',
] as const

const voidSchema = z.object({
  payment_id: z.string().uuid(),
  reason: z.enum(VOID_REASON_CODES),
  reason_detail: z.string().max(500).optional(),
  manager_pin: z.string().min(4).max(8).optional(),
})

/**
 * POST /api/payments/void — void a transaction before batch settlement
 *
 * Business rules:
 * - Can only void transactions from the current unsettled batch
 * - Voids over $100 (configurable) require manager PIN
 * - Releases card hold immediately — no interchange cost
 * - Updates payment status to 'voided' and reopens the order
 * - Full audit trail
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  // Servers can void small amounts; managers+ can void any amount
  const allowedRoles = ['server', 'bartender', 'cashier', 'manager', 'admin', 'owner', 'platform_admin']
  const roleCheck = requireRole(user, allowedRoles)
  if (roleCheck) return roleCheck

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = voidSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { payment_id, reason, reason_detail, manager_pin } = parsed.data
  const supabase = createAdminClient()

  // Fetch payment
  const { data: payment, error: paymentErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('id', payment_id)
    .eq('org_id', user.org_id)
    .single()

  if (paymentErr || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  const paymentData = payment as Record<string, unknown>

  // Only void authorized or captured (unsettled) transactions
  if (!['authorized', 'captured'].includes(paymentData.status as string)) {
    return NextResponse.json(
      { error: 'Payment cannot be voided in current status. Only authorized or captured (unsettled) payments can be voided.' },
      { status: 400 }
    )
  }

  // Check if already settled
  if (paymentData.status === 'settled') {
    return NextResponse.json(
      { error: 'Payment has been settled. Use refund instead of void.' },
      { status: 400 }
    )
  }

  const totalCents = Math.round(parseFloat(paymentData.total_amount as string) * 100)

  // Get void threshold from location settings (default $100 = 10000 cents)
  let voidThresholdCents = 10000
  const { data: locationSettings } = await (supabase.from('location_settings') as ReturnType<typeof supabase.from>)
    .select('settings')
    .eq('location_id', paymentData.location_id as string)
    .single()

  if (locationSettings) {
    const settings = (locationSettings as Record<string, unknown>).settings as Record<string, unknown>
    if (typeof settings?.void_threshold_cents === 'number') {
      voidThresholdCents = settings.void_threshold_cents as number
    }
  }

  // Manager PIN required for voids over threshold (unless user is already manager+)
  const isManagerRole = ['manager', 'admin', 'owner', 'platform_admin'].includes(user.role)
  if (totalCents > voidThresholdCents && !isManagerRole) {
    if (!manager_pin) {
      return NextResponse.json(
        {
          error: `Void over $${(voidThresholdCents / 100).toFixed(2)} requires manager PIN`,
          requires_manager_pin: true,
        },
        { status: 403 }
      )
    }

    // Validate manager PIN
    const { data: managers } = await (supabase.from('users') as ReturnType<typeof supabase.from>)
      .select('id, pin_hash')
      .eq('org_id', user.org_id)
      .in('role', ['manager', 'admin', 'owner'])

    let pinValid = false
    if (managers) {
      for (const mgr of managers as Record<string, unknown>[]) {
        if (mgr.pin_hash && typeof mgr.pin_hash === 'string') {
          const matches = await compare(manager_pin, mgr.pin_hash)
          if (matches) {
            pinValid = true
            break
          }
        }
      }
    }

    if (!pinValid) {
      return NextResponse.json(
        { error: 'Invalid manager PIN' },
        { status: 403 }
      )
    }
  }

  // Call Valor void API for card payments
  const isCard = ['credit_card', 'debit_card', 'apple_pay', 'google_pay'].includes(
    paymentData.payment_method as string
  )

  if (isCard && paymentData.processor_transaction_id) {
    const valor = getValorClient()
    const voidResult = await valor.void({
      transaction_id: paymentData.processor_transaction_id as string,
    })

    if (!voidResult.success) {
      return NextResponse.json(
        { error: 'Void failed at processor. The transaction may have already been settled.' },
        { status: 502 }
      )
    }
  }

  // Update payment status
  const { data: updated, error: updateErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .update({
      status: 'voided',
      refund_reason: `${reason}${reason_detail ? ': ' + reason_detail : ''}`,
      refunded_by: user.id,
      refunded_at: new Date().toISOString(),
      processor_response: {
        ...(paymentData.processor_response as Record<string, unknown>),
        void: {
          reason,
          reason_detail: reason_detail ?? null,
          voided_by: user.id,
          voided_at: new Date().toISOString(),
          required_manager_pin: totalCents > voidThresholdCents && !isManagerRole,
        },
      },
    })
    .eq('id', payment_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update payment record' }, { status: 500 })
  }

  // Restore order balance — reopen the check
  const { data: order } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('amount_paid, balance_due, total_cents')
    .eq('id', paymentData.order_id)
    .single()

  if (order) {
    const orderData = order as Record<string, unknown>
    const currentPaid = Math.round(parseFloat((orderData.amount_paid as string) ?? '0') * 100)
    const orderTotal = (orderData.total_cents as number) ?? 0

    const newPaid = Math.max(0, currentPaid - totalCents)
    const newBalance = Math.max(0, orderTotal - newPaid)

    await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update({
        amount_paid: (newPaid / 100).toFixed(2),
        balance_due: (newBalance / 100).toFixed(2),
        status: 'open',
      })
      .eq('id', paymentData.order_id)
  }

  // Create audit trail
  await (supabase.from('audit_log') as ReturnType<typeof supabase.from>)
    .insert({
      org_id: user.org_id,
      location_id: paymentData.location_id,
      user_id: user.id,
      action: 'payment_voided',
      entity_type: 'payment',
      entity_id: payment_id,
      details: {
        amount_cents: totalCents,
        reason,
        reason_detail: reason_detail ?? null,
        payment_method: paymentData.payment_method,
        order_id: paymentData.order_id,
      },
    })

  return NextResponse.json({ data: updated })
}
