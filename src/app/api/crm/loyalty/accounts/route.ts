import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { assertCrmGuest, assertProgram, crmLoyaltyReadRoles, crmLoyaltyServiceRoles, pagination } from '@/lib/crm/loyalty'
import { createCrmLoyaltyAccountSchema, listCrmLoyaltyAccountsQuerySchema } from '@/lib/schemas/crm'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmLoyaltyReadRoles])
  if (roleErr) return roleErr

  const parsed = listCrmLoyaltyAccountsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { page, limit, program_id, guest_id, search } = parsed.data
  const { offset, to } = pagination(page, limit)
  const db = createAdminClient()
  let query = db
    .from('crm_loyalty_accounts')
    .select('*, guests(id, display_name), crm_loyalty_programs(id, name, program_type), crm_loyalty_tiers(id, name)', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .range(offset, to)

  if (program_id) query = query.eq('program_id', program_id)
  if (guest_id) query = query.eq('guest_id', guest_id)
  if (search) query = query.ilike('account_number', `%${search.replace(/[%_]/g, '')}%`)

  const { data, error, count } = await query
  if (error) {
    return apiError(500, 'Failed to fetch CRM loyalty accounts')
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / limit) },
  })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmLoyaltyServiceRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createCrmLoyaltyAccountSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const db = createAdminClient()
  const guestResult = await assertCrmGuest(db, user, parsed.data.guest_id)
  if (guestResult.error) return guestResult.error
  const programResult = await assertProgram(db, user, parsed.data.program_id)
  if (programResult.error) return programResult.error

  const { data: account, error } = await db
    .from('crm_loyalty_accounts')
    .insert({
      ...parsed.data,
      org_id: user.org_id,
      legacy_customer_id: parsed.data.legacy_customer_id ?? guestResult.guest.legacy_customer_id,
    })
    .select('*, crm_loyalty_programs(id, name, program_type)')
    .single()

  if (error || !account) {
    return apiError(500, 'Failed to enroll CRM loyalty account')
  }

  await audit.record({
    actor: user,
    action: 'crm_loyalty_account_enrolled',
    entity_type: 'loyalty_account',
    entity_id: (account as { id: string }).id,
    after_state: account as Record<string, unknown>,
    description: 'Enrolled guest in CRM loyalty program',
    request,
    location_id: parsed.data.location_id ?? null,
  })

  return NextResponse.json({ data: account }, { status: 201 })
}
