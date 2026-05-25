import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { crmLoyaltyReadRoles, pagination } from '@/lib/crm/loyalty'

const listRedemptionsQuerySchema = z.object({
  account_id: z.string().uuid().optional(),
  reward_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmLoyaltyReadRoles])
  if (roleErr) return roleErr

  const parsed = listRedemptionsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { page, limit, account_id, reward_id, order_id } = parsed.data
  const { offset, to } = pagination(page, limit)
  const db = createAdminClient()
  let query = db
    .from('crm_reward_redemptions')
    .select('*, crm_rewards(id, name, reward_type), crm_loyalty_accounts(id, account_number)', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .range(offset, to)

  if (account_id) query = query.eq('account_id', account_id)
  if (reward_id) query = query.eq('reward_id', reward_id)
  if (order_id) query = query.eq('order_id', order_id)

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch CRM loyalty redemptions' }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / limit) },
  })
}
