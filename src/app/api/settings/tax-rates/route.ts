import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createTaxRateSchema = z.object({
  location_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  rate: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Rate must be a valid decimal'),
  is_inclusive: z.boolean().default(false),
  is_default: z.boolean().default(false),
  applies_to: z.array(z.string()).default(['food']),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const locationId = request.nextUrl.searchParams.get('location_id')

  const supabase = createAdminClient()
  let query = supabase
    .from('tax_rates')
    .select('*')
    .eq('org_id', user.org_id)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data, error } = await query

  if (error) {
    return apiError(500, 'Failed to fetch tax rates')
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

  const parsed = createTaxRateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // If this is being set as default, unset other defaults for this location
  if (parsed.data.is_default) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('tax_rates') as any)
      .update({ is_default: false })
      .eq('org_id', user.org_id)
      .eq('location_id', parsed.data.location_id)
      .eq('is_default', true)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('tax_rates') as any)
    .insert({ org_id: user.org_id, ...parsed.data })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to create tax rate')
  }

  return NextResponse.json({ data }, { status: 201 })
}
