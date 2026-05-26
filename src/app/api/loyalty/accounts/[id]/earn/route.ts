import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const earnSchema = z.object({
  points: z.number().int().min(1),
  order_id: z.string().uuid().optional(),
  description: z.string().max(500).default('Points earned'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = earnSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Fetch account and verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account } = await (supabase.from('loyalty_accounts') as any)
    .select('id, org_id, points_balance, total_earned')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .maybeSingle()

  if (!account) {
    return apiError(404, 'Account not found')
  }

  const newBalance = (account.points_balance ?? 0) + parsed.data.points
  const newTotalEarned = (account.total_earned ?? 0) + parsed.data.points

  // Update balance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase.from('loyalty_accounts') as any)
    .update({
      points_balance: newBalance,
      total_earned: newTotalEarned,
    })
    .eq('id', id)

  if (updateError) {
    return apiError(500, 'Failed to update balance')
  }

  // Create transaction record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transaction, error: txError } = await (supabase.from('loyalty_transactions') as any)
    .insert({
      loyalty_account_id: id,
      order_id: parsed.data.order_id ?? null,
      type: 'earn',
      points: parsed.data.points,
      description: parsed.data.description,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (txError) {
    return apiError(500, 'Failed to record transaction')
  }

  return NextResponse.json({
    data: {
      transaction,
      new_balance: newBalance,
      total_earned: newTotalEarned,
    },
  })
}
