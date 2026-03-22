import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const poItemSchema = z.object({
  inventory_item_id: z.string().uuid(),
  quantity_ordered: z.number().min(0.01),
  unit_cost: z.string(),
})

const createPOSchema = z.object({
  vendor_id: z.string().uuid(),
  location_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(poItemSchema).min(1),
})

/**
 * GET /api/inventory/purchase-orders — list purchase orders
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const vendorId = searchParams.get('vendor_id')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('purchase_orders') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  if (vendorId) {
    query = query.eq('vendor_id', vendorId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/inventory/purchase-orders — create purchase order with items
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createPOSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Calculate total
  const total = parsed.data.items.reduce(
    (sum, item) => sum + item.quantity_ordered * parseFloat(item.unit_cost),
    0
  )

  // Create PO
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: po, error: poErr } = await (supabase.from('purchase_orders') as any)
    .insert({
      org_id: user.org_id,
      vendor_id: parsed.data.vendor_id,
      location_id: parsed.data.location_id,
      status: 'draft',
      total: total.toFixed(2),
      notes: parsed.data.notes,
      created_by: user.id,
    })
    .select()
    .single()

  if (poErr || !po) {
    return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 })
  }

  // Create PO items
  const poItems = parsed.data.items.map((item) => ({
    purchase_order_id: po.id,
    inventory_item_id: item.inventory_item_id,
    quantity_ordered: item.quantity_ordered,
    quantity_received: 0,
    unit_cost: item.unit_cost,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: itemsErr } = await (supabase.from('purchase_order_items') as any)
    .insert(poItems)

  if (itemsErr) {
    // Rollback PO
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('purchase_orders') as any).delete().eq('id', po.id)
    return NextResponse.json({ error: 'Failed to create PO items' }, { status: 500 })
  }

  return NextResponse.json({ data: po }, { status: 201 })
}
