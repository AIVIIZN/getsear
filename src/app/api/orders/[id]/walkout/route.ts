import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { validateManagerPin } from '@/lib/auth/manager-pin'

const walkoutSchema = z.object({
  /** Manager PIN for authorization (bcrypt-hashed in DB) */
  manager_pin: z.string().min(4).max(10),
  notes: z.string().max(2000).optional(),
})

/**
 * POST /api/orders/[id]/walkout
 *
 * Marks an order as a walkout (dine-and-dash).
 * Requires manager PIN validation via bcrypt compare.
 * Records the full order total as house loss and creates audit trail.
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

  const parsed = walkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get the order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id, org_id, status, total, location_id, server_id, table_id')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.status === 'closed' || order.status === 'voided') {
    return NextResponse.json(
      { error: 'Cannot mark a closed or voided order as walkout' },
      { status: 400 }
    )
  }

  // SEC-1a: validate the PIN against ACTIVE managers via the canonical helper.
  // The helper filters is_active=true so terminated managers can't authorise.
  const validatingManagerId = await validateManagerPin(
    supabase,
    user.org_id,
    parsed.data.manager_pin
  )
  if (!validatingManagerId) {
    return NextResponse.json(
      { error: 'Invalid manager PIN' },
      { status: 403 }
    )
  }

  // Hydrate the manager's display name for the walkout metadata. The canonical
  // helper returns just the id; we still need first/last_name for human-readable
  // audit + the response shape that older clients render.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: managerRow } = await (supabase.from('users') as any)
    .select('id, first_name, last_name, role')
    .eq('id', validatingManagerId)
    .eq('org_id', user.org_id)
    .single()

  const validatingManager = (managerRow as {
    id: string
    first_name: string | null
    last_name: string | null
    role: string
  } | null) ?? {
    id: validatingManagerId,
    first_name: null,
    last_name: null,
    role: 'manager',
  }

  const houseLoss = parseFloat(order.total || '0')
  const managerName =
    [validatingManager.first_name, validatingManager.last_name].filter(Boolean).join(' ') ||
    'Manager'

  // Update order status to walkout
  // The schema uses 'voided' status since there's no 'walkout' enum value,
  // but we track the walkout in metadata and audit log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedOrder, error: updateError } = await (supabase.from('orders') as any)
    .update({
      status: 'voided',
      voided_at: new Date().toISOString(),
      voided_by: validatingManager.id,
      void_reason: 'walkout',
      metadata: {
        ...(order.metadata ?? {}),
        walkout: {
          house_loss: houseLoss.toFixed(2),
          notes: parsed.data.notes ?? null,
          manager_id: validatingManager.id,
          manager_name: managerName,
          reported_by: user.id,
          walkout_at: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Failed to mark order as walkout' }, { status: 500 })
  }

  // Create audit log entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_modifications') as any).insert({
    org_id: user.org_id,
    order_id: orderId,
    modification_type: 'walkout',
    description: `Walkout - House loss: $${houseLoss.toFixed(2)}${parsed.data.notes ? ` - ${parsed.data.notes}` : ''}`,
    new_value: {
      house_loss: houseLoss,
      notes: parsed.data.notes ?? null,
      manager_id: validatingManager.id,
      manager_name: managerName,
      server_id: order.server_id,
      table_id: order.table_id,
    },
    performed_by: validatingManager.id,
  })

  // Release the table if applicable
  if (order.table_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('tables') as any)
      .update({
        status: 'available',
        current_order_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.table_id)
  }

  return NextResponse.json({
    data: {
      order_id: orderId,
      status: 'walkout',
      house_loss: houseLoss.toFixed(2),
      approved_by: managerName,
      walkout_at: new Date().toISOString(),
    },
  })
}
