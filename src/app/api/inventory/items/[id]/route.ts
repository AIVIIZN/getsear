import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  unit: z.string().min(1).max(50).optional(),
  par_level: z.number().min(0).optional(),
  reorder_point: z.number().min(0).optional(),
  current_stock: z.number().min(0).optional(),
  unit_cost: z.string().optional(),
  category: z.string().max(100).optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/inventory/items/:id — get inventory item detail
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await context.params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('inventory_items') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !data) {
    return apiError(404, 'Item not found')
  }

  // Fetch recent transactions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transactions } = await (supabase.from('inventory_transactions') as any)
    .select('*')
    .eq('inventory_item_id', id)
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ data: { ...data, transactions: transactions ?? [] } })
}

/**
 * PUT /api/inventory/items/:id — update inventory item
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateItemSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('inventory_items') as any)
    .update(parsed.data)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return apiError(500, 'Failed to update item')
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/inventory/items/:id — deactivate inventory item
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await context.params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('inventory_items') as any)
    .update({ is_active: false })
    .eq('id', id)
    .eq('org_id', user.org_id)

  if (error) {
    return apiError(500, 'Failed to deactivate item')
  }

  return NextResponse.json({ success: true })
}
