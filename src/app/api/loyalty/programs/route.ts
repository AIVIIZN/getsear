import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createProgramSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['points', 'visits', 'spend']),
  points_per_dollar: z.number().min(0).default(1),
  points_per_visit: z.number().int().min(0).default(0),
  redemption_threshold: z.number().int().min(1).default(100),
  reward_value: z.number().min(0).default(5),
  is_active: z.boolean().default(true),
})

export async function GET(_request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('loyalty_programs') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch loyalty programs' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

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

  const parsed = createProgramSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('loyalty_programs') as any)
    .insert({
      org_id: user.org_id,
      name: parsed.data.name,
      type: parsed.data.type,
      points_per_dollar: parsed.data.points_per_dollar,
      points_per_visit: parsed.data.points_per_visit,
      redemption_threshold: parsed.data.redemption_threshold,
      reward_value: parsed.data.reward_value,
      is_active: parsed.data.is_active,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create loyalty program' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
