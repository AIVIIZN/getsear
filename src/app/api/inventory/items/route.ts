import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createItemSchema = z.object({
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(50),
  par_level: z.number().min(0).default(0),
  reorder_point: z.number().min(0).default(0),
  current_stock: z.number().min(0).default(0),
  unit_cost: z.string().default('0.00'),
  category: z.string().max(100).optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  location_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
})

/**
 * GET /api/inventory/items — list inventory items for org
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const lowStock = searchParams.get('low_stock')
  const search = searchParams.get('search')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('inventory_items') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('name', { ascending: true })

  if (category) {
    query = query.eq('category', category)
  }

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch inventory items' }, { status: 500 })
  }

  let items = data ?? []

  // Filter low stock items in JS since we need to compare two columns
  if (lowStock === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items = items.filter((item: any) => item.current_stock <= item.reorder_point)
  }

  return NextResponse.json({ data: items })
}

/**
 * POST /api/inventory/items — create inventory item
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

  const parsed = createItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('inventory_items') as any)
    .insert({
      org_id: user.org_id,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create inventory item' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
