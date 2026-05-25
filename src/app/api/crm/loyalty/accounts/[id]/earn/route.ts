import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { crmLoyaltyServiceRoles, earnPoints, loadAccount } from '@/lib/crm/loyalty'
import { earnCrmLoyaltyPointsSchema } from '@/lib/schemas/crm'

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

  const parsed = earnCrmLoyaltyPointsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { id } = await params
  const db = createAdminClient()
  const accountResult = await loadAccount(db, user, id)
  if (accountResult.error) return accountResult.error

  const result = await earnPoints({
    db,
    user,
    account: accountResult.account,
    points: parsed.data.points,
    amount_cents: parsed.data.amount_cents,
    visits: parsed.data.visits,
    order_id: parsed.data.order_id,
    event_type: parsed.data.event_type,
    explanation: parsed.data.explanation,
    metadata: parsed.data.metadata,
    request,
  })

  if (result.error) return result.error
  return NextResponse.json({ data: result.data })
}
