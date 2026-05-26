import { apiError } from '@/lib/api/error-response'
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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = lookupSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  const orParts: string[] = []
  if (parsed.data.phone) orParts.push(`phone.eq.${parsed.data.phone}`)
  if (parsed.data.email) orParts.push(`email.eq.${parsed.data.email}`)
  const { data, error } = await supabase.from('customers')
    .select('id, first_name, last_name, email, phone, is_vip, tags, total_visits, total_spend, last_visit_at, allergies')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .or(orParts.join(','))
    .limit(5)

  if (error) {
    return apiError(500, 'Lookup failed')
  }

  return NextResponse.json({ data: data ?? [] })
}
