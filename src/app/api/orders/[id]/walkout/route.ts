import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { compare } from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

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
  const { data: order } = await supabase.from('orders')
    .select('id, org_id, status, total, location_id, server_id, table_id, metadata')
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

  // Validate manager PIN
  // Find managers at this location and check their PINs
   
  const { data: managers } = await supabase.from('users')
    .select('id, pin_hash, first_name, last_name, role')
    .eq('org_id', user.org_id)
    .in('role', ['owner', 'admin', 'manager'])

  if (!managers || managers.length === 0) {
    return NextResponse.json(
      { error: 'No managers found for PIN validation' },
      { status: 400 }
    )
  }

  let validatingManager: { id: string; first_name: string; last_name: string; role: string } | null = null

  for (const manager of managers) {
    if (!manager.pin_hash) continue
    const isValid = await compare(parsed.data.manager_pin, manager.pin_hash)
    if (isValid) {
      validatingManager = manager
      break
    }
  }

  if (!validatingManager) {
    return NextResponse.json(
      { error: 'Invalid manager PIN' },
      { status: 403 }
    )
  }

  const houseLoss = parseFloat(order.total || '0')

  // Update order status to walkout
  // The schema uses 'voided' status since there's no 'walkout' enum value,
  // but we track the walkout in metadata and audit log
   
  const { data: updatedOrder, error: updateError } = await supabase.from('orders')
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
          manager_name: `${validatingManager.first_name} ${validatingManager.last_name}`,
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
   
  await supabase.from('order_modifications').insert({
    org_id: user.org_id,
    order_id: orderId,
    modification_type: 'walkout',
    description: `Walkout - House loss: $${houseLoss.toFixed(2)}${parsed.data.notes ? ` - ${parsed.data.notes}` : ''}`,
    new_value: {
      house_loss: houseLoss,
      notes: parsed.data.notes ?? null,
      manager_id: validatingManager.id,
      manager_name: `${validatingManager.first_name} ${validatingManager.last_name}`,
      server_id: order.server_id,
      table_id: order.table_id,
    },
    performed_by: validatingManager.id,
  })

  // Release the table if applicable
  if (order.table_id) {
     
    await supabase.from('tables')
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
      approved_by: `${validatingManager.first_name} ${validatingManager.last_name}`,
      walkout_at: new Date().toISOString(),
    },
  })
}
