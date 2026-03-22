import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const chargeSchema = z.object({
  amount: z.number().positive(),
  order_id: z.string().uuid().optional().nullable(),
  description: z.string().max(500).default('Charge'),
})

/** POST /api/house-accounts/[id]/charge — charge to account (from order) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'server', 'cashier', 'bartender'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = chargeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get account and check credit limit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account, error: accErr } = await (supabase.from('house_accounts') as any)
    .select('id, current_balance, credit_limit, is_active, account_name')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (accErr || !account) {
    return NextResponse.json({ error: 'House account not found' }, { status: 404 })
  }

  if (!account.is_active) {
    return NextResponse.json({ error: 'Account is inactive' }, { status: 400 })
  }

  const currentBalance = parseFloat(account.current_balance)
  const creditLimit = parseFloat(account.credit_limit)
  const chargeAmount = parsed.data.amount
  const newBalance = currentBalance + chargeAmount

  if (newBalance > creditLimit) {
    return NextResponse.json(
      {
        error: 'Charge would exceed credit limit',
        current_balance: currentBalance,
        credit_limit: creditLimit,
        charge_amount: chargeAmount,
        would_be_balance: newBalance,
      },
      { status: 400 }
    )
  }

  // Create transaction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transaction, error: txErr } = await (supabase.from('house_account_transactions') as any)
    .insert({
      house_account_id: id,
      order_id: parsed.data.order_id ?? null,
      amount: chargeAmount.toFixed(2),
      type: 'charge',
      description: parsed.data.description,
    })
    .select()
    .single()

  if (txErr) {
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
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
