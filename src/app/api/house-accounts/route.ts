import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createAccountSchema = z.object({
  account_name: z.string().min(1).max(200),
  customer_id: z.string().uuid().optional().nullable(),
  credit_limit: z.number().min(0),
  billing_email: z.string().email().optional().nullable(),
  billing_address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
    })
    .optional()
    .nullable(),
  auto_pay: z.boolean().default(false),
  payment_terms_days: z.number().int().min(0).max(120).default(30),
})

/** GET /api/house-accounts — list all house accounts */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const params = request.nextUrl.searchParams
  const search = params.get('search') ?? ''
  const status = params.get('status')
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '25', 10)))
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('house_accounts') as any)
    .select('*', { count: 'exact' })
    .eq('org_id', user.org_id)

  if (search.trim()) {
    const s = `%${search.trim()}%`
    query = query.or(`account_name.ilike.${s},billing_email.ilike.${s}`)
  }

  if (status === 'active') {
    query = query.eq('is_active', true)
  } else if (status === 'inactive') {
    query = query.eq('is_active', false)
  }

  query = query
    .order('account_name', { ascending: true })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return apiError(500, 'Failed to fetch house accounts')
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

/** POST /api/house-accounts — create a new house account */
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

  const parsed = createAccountSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Generate account number
  const accountNumber = `HA-${Date.now().toString(36).toUpperCase()}`
  const paymentTermsMap: Record<number, string> = { 0: 'due_on_receipt', 15: 'net_15', 30: 'net_30', 45: 'net_45', 60: 'net_60', 90: 'net_90' }
  const paymentTerms = paymentTermsMap[parsed.data.payment_terms_days] ?? `net_${parsed.data.payment_terms_days}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('house_accounts') as any)
    .insert({
      org_id: user.org_id,
      customer_id: parsed.data.customer_id ?? null,
      account_name: parsed.data.account_name,
      account_number: accountNumber,
      credit_limit: parsed.data.credit_limit,
      current_balance: 0,
      is_active: true,
      billing_email: parsed.data.billing_email ?? null,
      billing_address: parsed.data.billing_address ?? null,
      payment_terms: paymentTerms,
    })
    .select()
    .single()

  if (error) {
    console.error('[house-accounts/POST]', error.message, error.details)
    return apiError(500, 'Failed to create house account', { details: error.message, extra: { "details": error.message } })
  }

  return NextResponse.json({ data }, { status: 201 })
}
