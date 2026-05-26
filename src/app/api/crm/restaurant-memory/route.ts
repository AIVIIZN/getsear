import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { audit } from '@/lib/audit/log'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { crmAiAuditReadRoles } from '@/lib/crm/ai-gateway'
import { crmGuestOwnerRoles } from '@/lib/crm/api'
import {
  canManageRestaurantMemory,
  listRestaurantMemoryRules,
  seedDefaultRestaurantMemoryRules,
  upsertRestaurantMemoryRules,
} from '@/lib/crm/restaurant-memory'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertRestaurantMemoryRulesSchema } from '@/lib/schemas/crm'

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmAiAuditReadRoles])
  if (roleErr) return roleErr

  const db = createAdminClient()
  const rules = await listRestaurantMemoryRules({ user, db })
  const { data: auditHistory } = await db
    .from('audit_log')
    .select('id, action, entity_type, entity_id, user_id, user_role, description, before_state, after_state, created_at')
    .eq('org_id', user.org_id)
    .eq('entity_type', 'restaurant_memory_rule')
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    data: {
      rules,
      audit_history: auditHistory ?? [],
      can_edit: canManageRestaurantMemory(user),
    },
  })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestOwnerRoles])
  if (roleErr) return roleErr

  const body = await request.json().catch(() => null)
  const parsed = upsertRestaurantMemoryRulesSchema.safeParse(body)
  if (!parsed.success) return apiError(400, 'Invalid restaurant memory payload', { details: parsed.error.flatten(), extra: { "details": parsed.error.flatten() } })

  const before = await listRestaurantMemoryRules({ user })
  const rules = await upsertRestaurantMemoryRules({ user, rules: parsed.data.rules })

  await audit.record({
    actor: user,
    action: 'crm_restaurant_memory_updated',
    entity_type: 'restaurant_memory_rule',
    entity_id: rules[0]?.id ?? null,
    before_state: { rules: before },
    after_state: { rules },
    description: `Updated ${rules.length} restaurant memory rule${rules.length === 1 ? '' : 's'}`,
    request,
  })

  return NextResponse.json({ data: { rules } })
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestOwnerRoles])
  if (roleErr) return roleErr

  const db = createAdminClient()
  const rules = await seedDefaultRestaurantMemoryRules({ user, db })
  await audit.record({
    actor: user,
    action: 'crm_restaurant_memory_seeded',
    entity_type: 'restaurant_memory_rule',
    entity_id: null,
    after_state: { rules },
    description: 'Seeded default restaurant memory rules',
    request,
  })

  return NextResponse.json({ data: { rules } })
}
