import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const enrollSchema = z.object({
  customer_id: z.string().uuid(),
  program_id: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const searchParams = request.nextUrl.searchParams
  const customerId = searchParams.get('customer_id')
  const programId = searchParams.get('program_id')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10)))
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('loyalty_accounts') as any)
    .select('*', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('enrolled_at', { ascending: false })

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  if (programId) {
    query = query.eq('program_id', programId)
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch loyalty accounts' }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      total_pages: Math.ceil((count ?? 0) / limit),
    },
  })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = enrollSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Check customer belongs to org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customer } = await (supabase.from('customers') as any)
    .select('id')
    .eq('id', parsed.data.customer_id)
    .eq('org_id', user.org_id)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Check program belongs to org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: program } = await (supabase.from('loyalty_programs') as any)
    .select('id')
    .eq('id', parsed.data.program_id)
    .eq('org_id', user.org_id)
    .maybeSingle()

  if (!program) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404 })
  }

  // Check for existing enrollment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('loyalty_accounts') as any)
    .select('id')
    .eq('customer_id', parsed.data.customer_id)
    .eq('program_id', parsed.data.program_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Customer is already enrolled in this program' }, { status: 409 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('loyalty_accounts') as any)
    .insert({
      org_id: user.org_id,
      customer_id: parsed.data.customer_id,
      program_id: parsed.data.program_id,
      points_balance: 0,
      tier: 'bronze',
      total_earned: 0,
      total_redeemed: 0,
      enrolled_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to enroll customer' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
