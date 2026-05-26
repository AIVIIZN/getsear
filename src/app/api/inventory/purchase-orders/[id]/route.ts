import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updatePOSchema = z.object({
  status: z.enum(['draft', 'submitted', 'received', 'reconciled']).optional(),
  notes: z.string().max(2000).optional().nullable(),
  submitted_at: z.string().optional().nullable(),
})

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/inventory/purchase-orders/:id — get PO detail with items
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await context.params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: po, error } = await (supabase.from('purchase_orders') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !po) {
    return apiError(404, 'Purchase order not found')
  }

  // Fetch PO items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (supabase.from('purchase_order_items') as any)
    .select('*')
    .eq('purchase_order_id', id)

  return NextResponse.json({ data: { ...po, items: items ?? [] } })
}

/**
 * PUT /api/inventory/purchase-orders/:id — update PO
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

  const parsed = updatePOSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('purchase_orders') as any)
    .update(parsed.data)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return apiError(500, 'Failed to update purchase order')
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/inventory/purchase-orders/:id — cancel PO (only if draft)
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await context.params
  const supabase = createAdminClient()

  // Verify status is draft
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: po } = await (supabase.from('purchase_orders') as any)
    .select('id, status')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!po) {
    return apiError(404, 'Purchase order not found')
  }

  if (po.status !== 'draft') {
    return apiError(400, 'Only draft POs can be deleted')
  }

  // Delete items first, then PO
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('purchase_order_items') as any)
    .delete()
    .eq('purchase_order_id', id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('purchase_orders') as any)
    .delete()
    .eq('id', id)
    .eq('org_id', user.org_id)

  if (error) {
    return apiError(500, 'Failed to delete purchase order')
  }

  return NextResponse.json({ success: true })
}
