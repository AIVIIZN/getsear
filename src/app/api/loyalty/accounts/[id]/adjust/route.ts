import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const adjustSchema = z.object({
  points: z.number().int(),
  description: z.string().min(1).max(500),
})

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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = adjustSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  if (parsed.data.points === 0) {
    return NextResponse.json({ error: 'Adjustment points cannot be zero' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Fetch account and verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account } = await (supabase.from('loyalty_accounts') as any)
    .select('id, org_id, points_balance, total_earned, total_redeemed')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .maybeSingle()

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const newBalance = Math.max(0, (account.points_balance ?? 0) + parsed.data.points)

  // Update balance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase.from('loyalty_accounts') as any)
    .update({ points_balance: newBalance })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 })
  }

  // Create transaction record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transaction, error: txError } = await (supabase.from('loyalty_transactions') as any)
    .insert({
      loyalty_account_id: id,
      order_id: null,
      type: 'adjust',
      points: parsed.data.points,
      description: parsed.data.description,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (txError) {
    return NextResponse.json({ error: 'Failed to record transaction' }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      transaction,
      new_balance: newBalance,
    },
  })
}
