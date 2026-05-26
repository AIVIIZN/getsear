import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateRecipeSchema = z.object({
  quantity: z.number().min(0.001).optional(),
  unit: z.string().min(1).max(50).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PUT /api/inventory/recipes/:id — update recipe entry
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

  const parsed = updateRecipeSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('recipes') as any)
    .update(parsed.data)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return apiError(500, 'Failed to update recipe')
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/inventory/recipes/:id — delete recipe entry
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await context.params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('recipes') as any)
    .delete()
    .eq('id', id)
    .eq('org_id', user.org_id)

  if (error) {
    return apiError(500, 'Failed to delete recipe')
  }

  return NextResponse.json({ success: true })
}
