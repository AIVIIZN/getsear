import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const autoGratuitySchema = z.object({
  guest_count: z.number().int().min(1).max(999),
})

/**
 * POST /api/orders/[id]/auto-gratuity
 *
 * Adds auto-gratuity as a service charge line when guest_count >= threshold.
 * Auto-gratuity is stored as an order_discount with discount_type = 'auto_gratuity'
 * (negative discount = surcharge) or as a metadata entry on the order.
 *
 * The threshold and percentage come from location.settings:
 *   - auto_gratuity_threshold (default: 6)
 *   - auto_gratuity_percentage (default: 20, stored as whole number)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: orderId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = autoGratuitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get the order with location
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id, org_id, location_id, subtotal, metadata, total, tip_total')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Get location settings for auto-gratuity configuration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: location } = await (supabase.from('locations') as any)
    .select('settings')
    .eq('id', order.location_id)
    .single()

  const settings = location?.settings ?? {}
  const threshold = settings.auto_gratuity_threshold ?? 6
  const percentage = settings.auto_gratuity_percentage ?? 20

  const { guest_count } = parsed.data

  // Check if guest count meets threshold
  if (guest_count < threshold) {
    return NextResponse.json(
      {
        error: `Auto-gratuity requires ${threshold}+ guests. Current: ${guest_count}.`,
      },
      { status: 400 }
    )
  }

  // Check if auto-gratuity already applied
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('order_discounts') as any)
    .select('id')
    .eq('order_id', orderId)
    .eq('name', 'Auto-Gratuity')
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'Auto-gratuity already applied to this order' },
      { status: 409 }
    )
  }

  // Calculate auto-gratuity amount (percentage of subtotal)
  const subtotal = parseFloat(order.subtotal || '0')
  const gratuityAmount = Math.round(subtotal * (percentage / 100) * 100) / 100

  // Insert as a service charge (stored in order_discounts with negative semantics)
  // The name 'Auto-Gratuity' is used to identify and remove it later
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gratuity, error } = await (supabase.from('order_discounts') as any)
    .insert({
      order_id: orderId,
      order_item_id: null,
      name: 'Auto-Gratuity',
      discount_type: 'percentage',
      value: percentage.toString(),
      applied_amount: `-${gratuityAmount.toFixed(2)}`, // Negative = surcharge
      applied_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to apply auto-gratuity' }, { status: 500 })
  }

  // Update order: add gratuity to tip_total and update metadata
  const currentTipTotal = parseFloat(order.tip_total || '0')
  const newTipTotal = currentTipTotal + gratuityAmount
  const currentTotal = parseFloat(order.total || '0')
  const newTotal = currentTotal + gratuityAmount

  const metadata = {
    ...(order.metadata ?? {}),
    auto_gratuity: {
      percentage,
      amount: gratuityAmount.toFixed(2),
      guest_count,
      threshold,
      applied_at: new Date().toISOString(),
      applied_by: user.id,
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('orders') as any)
    .update({
      guest_count,
      tip_total: newTipTotal.toFixed(2),
      total: newTotal.toFixed(2),
      balance_due: newTotal.toFixed(2), // Will be corrected by payment flow
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  // Audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_modifications') as any).insert({
    org_id: user.org_id,
    order_id: orderId,
    modification_type: 'auto_gratuity',
    description: `Auto-gratuity ${percentage}% applied ($${gratuityAmount.toFixed(2)}) for ${guest_count} guests`,
    new_value: { percentage, amount: gratuityAmount, guest_count },
    performed_by: user.id,
  })

  return NextResponse.json({
    data: {
      id: gratuity.id,
      order_id: orderId,
      percentage,
      amount: gratuityAmount.toFixed(2),
      guest_count,
      threshold,
    },
  }, { status: 201 })
}

/**
 * DELETE /api/orders/[id]/auto-gratuity
 *
 * Removes auto-gratuity from the order. Requires manager role.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  // Only managers+ can remove auto-gratuity
  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id: orderId } = await params

  const supabase = createAdminClient()

  // Verify order exists and belongs to org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id, org_id, tip_total, total, metadata')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Find the auto-gratuity discount
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gratuityRecords } = await (supabase.from('order_discounts') as any)
    .select('id, applied_amount')
    .eq('order_id', orderId)
    .eq('name', 'Auto-Gratuity')

  if (!gratuityRecords || gratuityRecords.length === 0) {
    return NextResponse.json(
      { error: 'No auto-gratuity found on this order' },
      { status: 404 }
    )
  }

  // Calculate total gratuity amount being removed
  const gratuityAmount = gratuityRecords.reduce(
    (sum: number, g: { applied_amount: string }) =>
      sum + Math.abs(parseFloat(g.applied_amount || '0')),
    0
  )

  // Delete the auto-gratuity discount records
  for (const record of gratuityRecords) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('order_discounts') as any)
      .delete()
      .eq('id', record.id)
  }

  // Update order totals
  const currentTipTotal = parseFloat(order.tip_total || '0')
  const newTipTotal = Math.max(0, currentTipTotal - gratuityAmount)
  const currentTotal = parseFloat(order.total || '0')
  const newTotal = Math.max(0, currentTotal - gratuityAmount)

  const metadata = { ...(order.metadata ?? {}) }
  delete metadata.auto_gratuity

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('orders') as any)
    .update({
      tip_total: newTipTotal.toFixed(2),
      total: newTotal.toFixed(2),
      balance_due: newTotal.toFixed(2),
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  // Audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_modifications') as any).insert({
    org_id: user.org_id,
    order_id: orderId,
    modification_type: 'remove_auto_gratuity',
    description: `Auto-gratuity removed ($${gratuityAmount.toFixed(2)})`,
    new_value: { removed_amount: gratuityAmount },
    performed_by: user.id,
  })

  return NextResponse.json({
    data: {
      order_id: orderId,
      removed_amount: gratuityAmount.toFixed(2),
    },
  })
}
