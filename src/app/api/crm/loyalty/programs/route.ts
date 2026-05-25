import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmLoyaltyManageRoles, crmLoyaltyReadRoles, pagination } from '@/lib/crm/loyalty'
import { createCrmLoyaltyProgramSchema, listCrmLoyaltyProgramsQuerySchema } from '@/lib/schemas/crm'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmLoyaltyReadRoles])
  if (roleErr) return roleErr

  const parsed = listCrmLoyaltyProgramsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { page, limit, status, location_id } = parsed.data
  const { offset, to } = pagination(page, limit)
  const db = createAdminClient()
  let query = db
    .from('crm_loyalty_programs')
    .select('*, crm_loyalty_rules(*), crm_loyalty_tiers(*, crm_tier_benefits(*))', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .range(offset, to)

  if (status) query = query.eq('status', status)
  if (location_id) query = query.eq('location_id', location_id)

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch CRM loyalty programs' }, { status: 500 })
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

  const parsed = createCrmLoyaltyProgramSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { rules, tiers, ...programInput } = parsed.data
  const db = createAdminClient()
  const { data: program, error } = await db
    .from('crm_loyalty_programs')
    .insert({ ...programInput, org_id: user.org_id })
    .select()
    .single()

  if (error || !program) {
    return NextResponse.json({ error: 'Failed to create CRM loyalty program' }, { status: 500 })
  }

  if (rules.length) {
    const { error: rulesError } = await db.from('crm_loyalty_rules').insert(rules.map((rule) => ({
      ...rule,
      org_id: user.org_id,
      program_id: (program as { id: string }).id,
    })))
    if (rulesError) return NextResponse.json({ error: 'Failed to create CRM loyalty rules' }, { status: 500 })
  }

  for (const tier of tiers) {
    const { benefits, ...tierInput } = tier
    const { data: createdTier, error: tierError } = await db
      .from('crm_loyalty_tiers')
      .insert({ ...tierInput, org_id: user.org_id, program_id: (program as { id: string }).id })
      .select()
      .single()

    if (tierError || !createdTier) {
      return NextResponse.json({ error: 'Failed to create CRM loyalty tier' }, { status: 500 })
    }

    if (benefits.length) {
      const { error: benefitsError } = await db.from('crm_tier_benefits').insert(benefits.map((benefit) => ({
        ...benefit,
        org_id: user.org_id,
        tier_id: (createdTier as { id: string }).id,
      })))
      if (benefitsError) return NextResponse.json({ error: 'Failed to create CRM loyalty tier benefits' }, { status: 500 })
    }
  }

  await audit.record({
    actor: user,
    action: 'crm_loyalty_program_created',
    entity_type: 'loyalty_program',
    entity_id: (program as { id: string }).id,
    after_state: program as Record<string, unknown>,
    description: `Created CRM loyalty program ${(program as { name: string }).name}`,
    request,
    location_id: programInput.location_id ?? null,
  })

  return NextResponse.json({ data: program }, { status: 201 })
}
