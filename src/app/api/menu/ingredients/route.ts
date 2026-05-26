import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getEightySixLog } from '@/lib/menu/eighty-six-cascade'

const createIngredientSchema = z.object({
  location_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  category: z.string().max(100).optional().nullable(),
  unit_of_measure: z.string().min(1).max(50),
  par_level: z.number().min(0).optional().nullable(),
  reorder_point: z.number().min(0).optional().nullable(),
  current_quantity: z.number().min(0).optional().default(0),
  unit_cost: z.number().min(0).optional().nullable(),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { searchParams } = request.nextUrl
  const locationId = searchParams.get('location_id')
  const search = searchParams.get('search')
  const depleted = searchParams.get('depleted')
  const logParam = searchParams.get('log')

  // Return 86 log if requested
  if (logParam === 'true' && locationId) {
    const entries = await getEightySixLog(user.org_id, locationId)
    return NextResponse.json({ data: entries })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('inventory_items') as any)
    .select('id, name, category, unit_of_measure, current_quantity, par_level, reorder_point, is_active')
    .eq('org_id', user.org_id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`)
  }

  if (depleted === 'true') {
    query = query.lte('current_quantity', 0)
  }

  const { data, error } = await query

  if (error) {
    return apiError(500, 'Failed to fetch ingredients')
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'kitchen'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createIngredientSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
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
    return apiError(500, 'Failed to create ingredient')
  }

  return NextResponse.json({ data }, { status: 201 })
}
