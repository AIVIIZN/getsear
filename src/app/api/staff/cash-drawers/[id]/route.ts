import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

function serializeDrawer<T extends { is_open?: boolean; opened_by?: string | null }>(drawer: T) {
  return {
    ...drawer,
    status: drawer.is_open ? 'open' : 'closed',
    assigned_to: drawer.opened_by ?? null,
  }
}

/**
 * GET /api/staff/cash-drawers/[id] — get drawer detail
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: drawer, error } = await (supabase.from('cash_drawers') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !drawer) {
    return apiError(404, 'Cash drawer not found')
  }

  return NextResponse.json({ data: serializeDrawer(drawer) })
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  terminal_id: z.string().uuid().nullable().optional(),
})

/**
 * PUT /api/staff/cash-drawers/[id] — update drawer settings
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('cash_drawers') as any)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to update cash drawer')
  }

  return NextResponse.json({ data: serializeDrawer(data) })
}
