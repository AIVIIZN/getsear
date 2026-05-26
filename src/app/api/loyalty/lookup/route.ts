import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const lookupSchema = z.object({
  phone: z.string().min(10).max(15),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = lookupSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.flatten().fieldErrors)
  }

  const db = createAdminClient()
  const normalizedPhone = parsed.data.phone.replace(/\D/g, '').slice(-10)

  // Find customer by phone
  const { data: customer } = await db
    .from('customers')
    .select('id, first_name, last_name, phone, email')
    .eq('org_id', user.org_id)
    .eq('phone', normalizedPhone)
    .single()

  if (!customer) {
    return NextResponse.json({
      data: null,
      found: false,
      message: 'No customer found with this phone number',
    })
  }

  // Find loyalty account
  const { data: account } = await db
    .from('loyalty_accounts')
    .select('id, points_balance, tier, total_earned, total_redeemed, program_id, enrolled_at')
    .eq('org_id', user.org_id)
    .eq('customer_id', customer.id)
    .single()

  if (!account) {
    return NextResponse.json({
      data: {
        customer_id: customer.id,
        customer_name: `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || 'Guest',
        phone: customer.phone,
      },
      found: true,
      enrolled: false,
      message: 'Customer found but not enrolled in loyalty',
    })
  }

  // Get available rewards
  const { data: rewards } = await db
    .from('loyalty_rewards')
    .select('id, name, description, points_cost, type, value')
    .eq('org_id', user.org_id)
    .eq('is_active', true)
    .lte('points_cost', account.points_balance)
    .order('points_cost', { ascending: true })

  // Get recent transactions
  const { data: transactions } = await db
    .from('loyalty_transactions')
    .select('id, type, points, description, created_at')
    .eq('account_id', account.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    data: {
      account_id: account.id,
      customer_id: customer.id,
      customer_name: `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || 'Guest',
      phone: customer.phone,
      points_balance: account.points_balance,
      tier: account.tier,
      total_earned: account.total_earned,
      total_redeemed: account.total_redeemed,
      enrolled_at: account.enrolled_at,
      available_rewards: rewards ?? [],
      recent_transactions: transactions ?? [],
    },
    found: true,
    enrolled: true,
  })
}
