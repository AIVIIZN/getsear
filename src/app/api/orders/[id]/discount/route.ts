import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { recalculateOrderTotals } from '@/lib/tax/recalculate-order'
import { assertVersion } from '@/lib/orders/concurrency'
import { audit } from '@/lib/audit/log'
import { validateManagerPin } from '@/lib/auth/manager-pin'

const discountSchema = z.object({
  name: z.string().min(1).max(200),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  value: z.number().positive().max(100),
  order_item_id: z.string().uuid().nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
  manager_pin: z.string().min(4).max(8).optional(),
})

/**
 * Threshold above which manager-PIN is required (V5.99.7 default).
 * - percentage discounts > 10% (any amount)
 * - fixed-amount discounts > $10 OR > 10% of subtotal
 * Below the threshold, server/bartender/cashier can apply without a PIN.
 * Managers+ never need a PIN for their own actions.
 */
const PERCENTAGE_THRESHOLD = 10
const FIXED_DOLLAR_THRESHOLD = 10
const FIXED_PERCENTAGE_THRESHOLD = 10

const MANAGER_ROLES = ['manager', 'admin', 'owner', 'platform_admin'] as const
const ALLOWED_ROLES = ['server', 'bartender', 'cashier', ...MANAGER_ROLES] as const

/**
 * POST /api/orders/[id]/discount -- apply discount to order or item
 *
 * SECURITY (V5.99.7):
 *   - requireRole on every authenticated user (no host/kitchen).
 *   - Manager-PIN required for "large" discounts (>10% or >$10 fixed) when the
 *     actor is not already a manager.
 *   - Always writes audit.record({action: 'order_discount_applied', ...}) with
 *     before/after state — was previously zero audit coverage.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ALLOWED_ROLES as unknown as string[])
  if (roleErr) return roleErr

  const { id: orderId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = discountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // V5.4.1 optimistic-lock guard. Applying a discount triggers
  // `recalculateOrderTotals` below, which UPDATEs the order row.
  const check = await assertVersion(supabase, request, orderId, user.org_id, {
    select: 'id, org_id, subtotal, amount_paid, version, location_id, total',
  })
  if (!check.ok) return check.response

  const order = check.currentRow as {
    id: string
    org_id: string
    subtotal: string
    amount_paid: string
    location_id: string | null
    total: string | null
  }

  const { name, discount_type, value, order_item_id, reason, manager_pin } = parsed.data

  // Calculate applied amount
  let appliedAmount: number
  let baseAmount: number

  if (order_item_id) {
    // Item-level discount
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: item } = await (supabase.from('order_items') as any)
      .select('line_total')
      .eq('id', order_item_id)
      .eq('order_id', orderId)
      .single()

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    baseAmount = parseFloat(item.line_total)
    appliedAmount =
      discount_type === 'percentage'
        ? Math.round(baseAmount * (value / 100) * 100) / 100
        : Math.min(value, baseAmount)
  } else {
    // Order-level discount
    baseAmount = parseFloat(order.subtotal)
    appliedAmount =
      discount_type === 'percentage'
        ? Math.round(baseAmount * (value / 100) * 100) / 100
        : Math.min(value, baseAmount)
  }

  // -------- Manager-PIN gating ---------------------------------------------
  const isManager = (MANAGER_ROLES as unknown as string[]).includes(user.role)
  const fixedExceedsPctOfSubtotal =
    discount_type === 'fixed_amount' &&
    baseAmount > 0 &&
    (appliedAmount / baseAmount) * 100 > FIXED_PERCENTAGE_THRESHOLD

  const requiresManagerPin =
    !isManager &&
    ((discount_type === 'percentage' && value > PERCENTAGE_THRESHOLD) ||
      (discount_type === 'fixed_amount' && appliedAmount > FIXED_DOLLAR_THRESHOLD) ||
      fixedExceedsPctOfSubtotal)

  let managerPinUserId: string | null = null

  if (requiresManagerPin) {
    if (!manager_pin) {
      return NextResponse.json(
        {
          error: `Discount over the threshold requires manager PIN`,
          requires_manager_pin: true,
        },
        { status: 403 }
      )
    }

    managerPinUserId = await validateManagerPin(supabase, user.org_id, manager_pin)
    if (!managerPinUserId) {
      return NextResponse.json(
        { error: 'Invalid manager PIN' },
        { status: 403 }
      )
    }
  }

  // -------- Capture before-state ------------------------------------------
  const beforeState = {
    subtotal: order.subtotal,
    total: order.total,
    amount_paid: order.amount_paid,
  }

  // Insert discount record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: discount, error } = await (supabase.from('order_discounts') as any)
    .insert({
      order_id: orderId,
      order_item_id: order_item_id ?? null,
      name,
      discount_type,
      value: value.toString(),
      applied_amount: appliedAmount.toFixed(2),
      applied_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to apply discount' }, { status: 500 })
  }

  // Recalculate order totals using the tax engine (no more hardcoded 8.5%)
  // — this UPDATE bumps the order version (V5.4.1).
  await recalculateOrderTotals(supabase, orderId, user.org_id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: refreshed } = await (supabase.from('orders') as any)
    .select('version, subtotal, total, amount_paid')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .maybeSingle()
  const newVersion = (refreshed?.version as number | undefined) ?? check.currentVersion + 1

  // -------- Audit ---------------------------------------------------------
  await audit.record({
    actor: user,
    manager_pin_user_id: managerPinUserId,
    action: 'order_discount_applied',
    entity_type: 'order',
    entity_id: orderId,
    description: `${discount_type === 'percentage' ? `${value}%` : `$${value.toFixed(2)}`} discount: ${name}`,
    before_state: beforeState,
    after_state: {
      discount_id: (discount as { id?: string } | null)?.id ?? null,
      name,
      discount_type,
      value,
      applied_amount: appliedAmount.toFixed(2),
      order_item_id: order_item_id ?? null,
      subtotal: refreshed?.subtotal ?? null,
      total: refreshed?.total ?? null,
    },
    reason: reason ?? null,
    location_id: order.location_id,
    request,
  })

  return NextResponse.json(
    { data: discount },
    { status: 201, headers: { ETag: `"${newVersion}"` } }
  )
}
