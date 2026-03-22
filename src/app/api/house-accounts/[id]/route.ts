import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateAccountSchema = z.object({
  account_name: z.string().min(1).max(200).optional(),
  credit_limit: z.number().min(0).optional(),
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
  auto_pay: z.boolean().optional(),
  payment_terms_days: z.number().int().min(0).max(120).optional(),
  is_active: z.boolean().optional(),
})

/** GET /api/house-accounts/[id] — get account with recent transactions */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // Get account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account, error: accErr } = await (supabase.from('house_accounts') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (accErr || !account) {
    return NextResponse.json({ error: 'House account not found' }, { status: 404 })
  }

  // Get recent transactions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transactions } = await (supabase.from('house_account_transactions') as any)
    .select('*')
    .eq('house_account_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    data: {
      ...account,
      transactions: transactions ?? [],
    },
  })
}

/** PATCH /api/house-accounts/[id] — update account */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const updatePayload: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.credit_limit !== undefined) {
    updatePayload.credit_limit = parsed.data.credit_limit.toFixed(2)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('house_accounts') as any)
    .update(updatePayload)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update house account' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'House account not found' }, { status: 404 })
  }

  return NextResponse.json({ data })
}
