import { apiError } from '@/lib/api/error-response'
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
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
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
    return apiError(500, 'Failed to fetch CRM loyalty programs')
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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createCrmLoyaltyProgramSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { rules, tiers, ...programInput } = parsed.data
  const db = createAdminClient()
  const { data: program, error } = await db
    .from('crm_loyalty_programs')
    .insert({ ...programInput, org_id: user.org_id })
    .select()
    .single()

  if (error || !program) {
    return apiError(500, 'Failed to create CRM loyalty program')
  }

  if (rules.length) {
    const { error: rulesError } = await db.from('crm_loyalty_rules').insert(rules.map((rule) => ({
      ...rule,
      org_id: user.org_id,
      program_id: (program as { id: string }).id,
    })))
    if (rulesError) return apiError(500, 'Failed to create CRM loyalty rules')
  }

  for (const tier of tiers) {
    const { benefits, ...tierInput } = tier
    const { data: createdTier, error: tierError } = await db
      .from('crm_loyalty_tiers')
      .insert({ ...tierInput, org_id: user.org_id, program_id: (program as { id: string }).id })
      .select()
      .single()

    if (tierError || !createdTier) {
      return apiError(500, 'Failed to create CRM loyalty tier')
    }

    if (benefits.length) {
      const { error: benefitsError } = await db.from('crm_tier_benefits').insert(benefits.map((benefit) => ({
        ...benefit,
        org_id: user.org_id,
        tier_id: (createdTier as { id: string }).id,
      })))
      if (benefitsError) return apiError(500, 'Failed to create CRM loyalty tier benefits')
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
