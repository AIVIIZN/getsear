import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100),
  address_line1: z.string().max(500).optional(),
  address_line2: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zip: z.string().max(20).optional(),
  country: z.string().max(2).default('US'),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  timezone: z.string().default('America/New_York'),
  currency: z.string().max(3).default('USD'),
})

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createLocationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('locations') as any)
    .insert({ org_id: user.org_id, ...parsed.data })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create location' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
