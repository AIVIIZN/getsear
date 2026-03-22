import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const lookupSchema = z.object({
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
}).refine((data) => data.phone || data.email, {
  message: 'Either phone or email is required',
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = lookupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const orParts: string[] = []
  if (parsed.data.phone) orParts.push(`phone.eq.${parsed.data.phone}`)
  if (parsed.data.email) orParts.push(`email.eq.${parsed.data.email}`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('customers') as any)
    .select('id, first_name, last_name, email, phone, is_vip, tags, total_visits, total_spend, last_visit_at, allergies')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .or(orParts.join(','))
    .limit(5)

  if (error) {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
