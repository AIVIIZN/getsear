import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createMenuBoardSchema = z.object({
  location_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  type: z.enum(['drive_thru', 'indoor', 'outdoor']),
  schedule: z.record(z.string(), z.unknown()).optional().nullable(),
  content: z.record(z.string(), z.unknown()).optional().nullable(),
  is_active: z.boolean().optional().default(true),
})

/**
 * GET /api/drive-thru/menu-boards — list digital menu boards
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const params = request.nextUrl.searchParams
  const locationId = params.get('location_id')
  const type = params.get('type')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('digital_menu_boards') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('name', { ascending: true })

  if (locationId) query = query.eq('location_id', locationId)
  if (type) query = query.eq('type', type)

  const { data, error } = await query

  if (error) {
    return apiError(500, 'Failed to fetch menu boards')
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/drive-thru/menu-boards — create a digital menu board
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

  const parsed = createMenuBoardSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('digital_menu_boards') as any)
    .insert({
      org_id: user.org_id,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to create menu board')
  }

  return NextResponse.json({ data }, { status: 201 })
}
