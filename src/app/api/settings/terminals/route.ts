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
    return NextResponse.json({ error: 'Failed to fetch terminals' }, { status: 500 })
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createTerminalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('terminals')
    .insert({
      org_id: user.org_id,
      ...parsed.data,
      is_active: true,
      is_online: false,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to register terminal' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
