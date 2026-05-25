import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { assertProgram, crmLoyaltyManageRoles, crmLoyaltyReadRoles, pagination } from '@/lib/crm/loyalty'
import { createCrmRewardSchema, listCrmRewardsQuerySchema } from '@/lib/schemas/crm'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmLoyaltyReadRoles])
  if (roleErr) return roleErr

  const parsed = listCrmRewardsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { page, limit, program_id, status } = parsed.data
  const { offset, to } = pagination(page, limit)
  const db = createAdminClient()
  let query = db
    .from('crm_rewards')
    .select('*, crm_loyalty_programs(id, name), crm_loyalty_tiers(id, name)', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .range(offset, to)

  if (program_id) query = query.eq('program_id', program_id)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch CRM loyalty rewards' }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / limit) },
  })
}

export async function POST(request: NextRequest) {
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

  const parsed = createCrmRewardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const db = createAdminClient()
  const programResult = await assertProgram(db, user, parsed.data.program_id)
  if (programResult.error) return programResult.error

  const { data: reward, error } = await db
    .from('crm_rewards')
    .insert({ ...parsed.data, org_id: user.org_id })
    .select()
    .single()

  if (error || !reward) {
    return NextResponse.json({ error: 'Failed to create CRM loyalty reward' }, { status: 500 })
  }

  await audit.record({
    actor: user,
    action: 'crm_loyalty_reward_created',
    entity_type: 'loyalty_reward',
    entity_id: (reward as { id: string }).id,
    after_state: reward as Record<string, unknown>,
    description: `Created CRM loyalty reward ${(reward as { name: string }).name}`,
    request,
    location_id: parsed.data.location_id ?? null,
  })

  return NextResponse.json({ data: reward }, { status: 201 })
}
