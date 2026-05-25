import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { crmLoyaltyReadRoles, loadAccount, pagination } from '@/lib/crm/loyalty'
import { listCrmLedgerQuerySchema } from '@/lib/schemas/crm'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmLoyaltyReadRoles])
  if (roleErr) return roleErr

  const parsed = listCrmLedgerQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { id } = await params
  const db = createAdminClient()
  const accountResult = await loadAccount(db, user, id)
  if (accountResult.error) return accountResult.error

  const { page, limit } = parsed.data
  const { offset, to } = pagination(page, limit)
  const { data, error, count } = await db
    .from('crm_points_ledger')
    .select('id, event_type, points_delta, balance_after, source, explanation, order_id, redemption_id, metadata, created_at', { count: 'exact' })
    .eq('org_id', user.org_id)
    .eq('account_id', id)
    .order('created_at', { ascending: false })
    .range(offset, to)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch CRM loyalty ledger' }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / limit) },
  })
}
