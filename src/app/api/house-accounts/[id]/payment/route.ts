import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const paymentSchema = z.object({
  amount: z.number().positive(),
  description: z.string().max(500).default('Payment received'),
})

/** POST /api/house-accounts/[id]/payment — record a payment */
export async function POST(
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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Get account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account, error: accErr } = await (supabase.from('house_accounts') as any)
    .select('id, current_balance, account_name')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (accErr || !account) {
    return apiError(404, 'House account not found')
  }

  const currentBalance = parseFloat(account.current_balance)
  const paymentAmount = parsed.data.amount
  const newBalance = Math.max(0, currentBalance - paymentAmount)

  // Create transaction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transaction, error: txErr } = await (supabase.from('house_account_transactions') as any)
    .insert({
      house_account_id: id,
      amount: (-paymentAmount).toFixed(2),
      type: 'payment',
      description: parsed.data.description,
    })
    .select()
    .single()

  if (txErr) {
    return apiError(500, 'Failed to record payment')
  }

  // Update account balance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('house_accounts') as any)
    .update({ current_balance: newBalance.toFixed(2) })
    .eq('id', id)

  return NextResponse.json({
    data: {
      transaction,
      new_balance: newBalance,
      account_name: account.account_name,
    },
  }, { status: 201 })
}
