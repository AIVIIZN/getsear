import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { createAdminClient } from '@/lib/supabase/admin'
import { crmLoyaltyManageRoles } from '@/lib/crm/loyalty'
import { generateLoyaltyReviewItems } from '@/lib/crm/loyalty-fraud'
import { listCrmLoyaltyFraudQuerySchema, updateCrmLoyaltyReviewItemSchema } from '@/lib/schemas/crm'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmLoyaltyManageRoles, 'analyst'])
  if (roleErr) return roleErr

  const parsed = listCrmLoyaltyFraudQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const db = createAdminClient()
  if (parsed.data.generate) await generateLoyaltyReviewItems({ db, user, days: parsed.data.days })

  let query = db
    .from('crm_loyalty_review_items')
    .select('*, guests(id, display_name), crm_loyalty_accounts(id, account_number), crm_rewards(id, name)', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('detected_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.status) query = query.eq('status', parsed.data.status)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: 'Failed to fetch loyalty review items' }, { status: 500 })

  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmLoyaltyManageRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateCrmLoyaltyReviewItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const db = createAdminClient()
  const reviewed = parsed.data.status === 'resolved' || parsed.data.status === 'dismissed'
  const { data, error } = await db
    .from('crm_loyalty_review_items')
    .update({
      status: parsed.data.status,
      resolution_note: parsed.data.resolution_note ?? null,
      reviewed_by: reviewed ? user.id : null,
      reviewed_at: reviewed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.review_item_id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to update loyalty review item' }, { status: 500 })

  await audit.record({
    actor: user,
    action: 'crm_loyalty_review_item_updated',
    entity_type: 'loyalty_review_item',
    entity_id: parsed.data.review_item_id,
    after_state: data as Record<string, unknown>,
    description: `Updated loyalty review item to ${parsed.data.status}`,
    request,
    location_id: (data as { location_id: string | null }).location_id,
  })

  return NextResponse.json({ data })
}
