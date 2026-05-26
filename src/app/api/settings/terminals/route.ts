import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { TERMINAL_TYPES } from '@/lib/constants'

const createTerminalSchema = z.object({
  location_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  terminal_type: z.enum(TERMINAL_TYPES),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const locationId = request.nextUrl.searchParams.get('location_id')

  const supabase = createAdminClient()
  let query = supabase
    .from('terminals')
    .select('*')
    .eq('org_id', user.org_id)
    .order('name', { ascending: true })

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data, error } = await query

  if (error) {
    return apiError(500, 'Failed to fetch terminals')
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createTerminalSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('terminals') as any)
    .insert({
      org_id: user.org_id,
      ...parsed.data,
      is_active: true,
      is_online: false,
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to register terminal')
  }

  return NextResponse.json({ data }, { status: 201 })
}
