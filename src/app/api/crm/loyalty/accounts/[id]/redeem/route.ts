import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { crmLoyaltyServiceRoles, loadAccount, redeemReward } from '@/lib/crm/loyalty'
import { redeemCrmRewardSchema } from '@/lib/schemas/crm'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmLoyaltyServiceRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = redeemCrmRewardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { id } = await params
  const db = createAdminClient()
  const accountResult = await loadAccount(db, user, id)
  if (accountResult.error) return accountResult.error

  const result = await redeemReward({
    db,
    user,
    account: accountResult.account,
    rewardId: parsed.data.reward_id,
    orderId: parsed.data.order_id,
    status: parsed.data.status,
    explanation: parsed.data.explanation,
    metadata: parsed.data.metadata,
    request,
  })

  if (result.error) return result.error
  return NextResponse.json({ data: result.data })
}
