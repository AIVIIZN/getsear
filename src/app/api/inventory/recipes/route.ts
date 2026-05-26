import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createRecipeSchema = z.object({
  menu_item_id: z.string().uuid(),
  inventory_item_id: z.string().uuid(),
  quantity: z.number().min(0.001),
  unit: z.string().min(1).max(50),
})

/**
 * GET /api/inventory/recipes — list recipes (menu item to ingredient mapping)
 */
export async function GET(_request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('recipes') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('menu_item_id', { ascending: true })

  if (error) {
    return apiError(500, 'Failed to fetch recipes')
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/inventory/recipes — create recipe entry
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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createRecipeSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('recipes') as any)
    .insert({
      org_id: user.org_id,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to create recipe')
  }

  return NextResponse.json({ data }, { status: 201 })
}
